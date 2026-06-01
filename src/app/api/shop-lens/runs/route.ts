import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { eq } from 'drizzle-orm'
import { getShopLensDatabaseUrl, shopLensDb as db } from '@/db'
import { agentRuns, imageAssets, runEvents, shopSessions } from '@/db/schema'
import { checkIPRateLimit } from '@/lib/rate-limiter'
import { enqueueShopLensRun } from '@/lib/shop-lens/qstash'
import { processShopLensRun } from '@/lib/shop-lens/agent'
import { assertAcceptedImage, makeShopLensObjectKey, normalizeImageBytes } from '@/lib/shop-lens/image'
import { storeShopLensObject } from '@/lib/shop-lens/storage'
import { createVisitorCookie, readVisitorCookie, SHOP_LENS_VISITOR_COOKIE } from '@/lib/shop-lens/visitor'
import { shopId } from '@/lib/shop-lens/ids'
import { SHOP_LENS_MAX_UPLOADS } from '@/lib/shop-lens/types'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
    request.headers.get('x-real-ip') ||
    'unknown'
  const ipCheck = await checkIPRateLimit(ip)
  if (!ipCheck.allowed) {
    return NextResponse.json({ error: ipCheck.reason }, { status: 429 })
  }

  const form = await request.formData()
  const prompt = String(form.get('prompt') || '').trim()
  if (!prompt) {
    return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
  }

  const files = form.getAll('images').filter((value): value is File => value instanceof File)
  if (!files.length) {
    return NextResponse.json({ error: 'At least one image is required' }, { status: 400 })
  }
  if (files.length > SHOP_LENS_MAX_UPLOADS) {
    return NextResponse.json({ error: `Upload up to ${SHOP_LENS_MAX_UPLOADS} images` }, { status: 400 })
  }
  try {
    for (const file of files) {
      assertAcceptedImage(file)
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid upload' }, { status: 400 })
  }

  if (!getShopLensDatabaseUrl()) {
    return NextResponse.json({ error: 'Shop Lens database is not configured.' }, { status: 503 })
  }

  const existingVisitor = readVisitorCookie(request.cookies.get(SHOP_LENS_VISITOR_COOKIE)?.value)
  const visitorCookie = existingVisitor ? null : createVisitorCookie()
  const visitorId = existingVisitor ?? visitorCookie!.value.split('.')[0]
  const sessionId = shopId('sess')
  const runId = shopId('run')
  const now = new Date()
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24)

  await db.insert(shopSessions).values({
    id: sessionId,
    visitorId,
    status: 'active',
    initialPrompt: prompt,
    currentPrompt: prompt,
    preferredAspectRatio: '9:16',
    expiresAt,
  })

  await db.insert(agentRuns).values({
    id: runId,
    sessionId,
    parentRunId: null,
    trigger: 'initial_prompt',
    status: 'queued',
    currentState: 'queued',
    timeoutAt: new Date(Date.now() + 30 * 60 * 1000),
  })

  await db.insert(runEvents).values({
    sessionId,
    runId,
    eventType: 'created',
    fromState: null,
    toState: 'queued',
    message: 'Created Shop Lens run',
    metadataJson: {},
  })

  try {
    for (const file of files) {
      assertAcceptedImage(file)
      const raw = Buffer.from(await file.arrayBuffer())
      const normalized = await normalizeImageBytes(raw)
      const key = makeShopLensObjectKey(`uploads/${sessionId}`)
      const stored = await storeShopLensObject({
        key,
        bytes: normalized.bytes,
        contentType: normalized.contentType,
      })
      await db.insert(imageAssets).values({
        id: shopId('asset'),
        sessionId,
        role: 'scene',
        source: 'upload',
        storageUrl: stored.storageUrl,
        originalUrl: null,
        mimeType: normalized.contentType,
        width: normalized.width,
        height: normalized.height,
        aspectRatio: normalized.aspectRatio,
        sizeBytes: normalized.bytes.byteLength,
        exifOrientationApplied: normalized.exifOrientationApplied,
        metadataJson: { r2Key: stored.cached ? stored.key : undefined, originalName: file.name },
        createdAt: now,
      })
    }
  } catch (error) {
    await db.update(agentRuns).set({
      status: 'failed',
      currentState: 'failed',
      errorCode: 'UPLOAD_FAILED',
      errorMessage: error instanceof Error ? error.message : String(error),
      completedAt: new Date(),
    }).where(eq(agentRuns.id, runId))
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Upload failed' }, { status: 400 })
  }

  const qstashMessageId = await enqueueShopLensRun(runId)
  if (qstashMessageId) {
    await db.update(agentRuns).set({ qstashMessageId }).where(eq(agentRuns.id, runId))
  } else if (process.env.NODE_ENV !== 'production') {
    void processShopLensRun(runId).catch((error) => {
      console.error('Shop Lens local worker failed', error)
    })
  }

  const response = NextResponse.json({ sessionId, runId, status: 'queued' }, { status: 202 })
  if (visitorCookie) {
    response.cookies.set(visitorCookie.name, visitorCookie.value, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    })
  }
  response.headers.set('x-shop-lens-request-id', randomUUID())
  return response
}
