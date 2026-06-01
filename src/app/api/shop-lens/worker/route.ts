import { Receiver } from '@upstash/qstash'
import { NextResponse } from 'next/server'
import { processShopLensRun } from '@/lib/shop-lens/agent'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

async function verifyQstash(request: Request, body: string): Promise<boolean> {
  if (!process.env.QSTASH_CURRENT_SIGNING_KEY || !process.env.QSTASH_NEXT_SIGNING_KEY) {
    return process.env.NODE_ENV !== 'production'
  }
  const receiver = new Receiver({
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY,
  })
  return receiver.verify({
    signature: request.headers.get('upstash-signature') ?? '',
    body,
    url: request.url,
  })
}

export async function POST(request: Request) {
  const bodyText = await request.text()
  const verified = await verifyQstash(request, bodyText)
  if (!verified) return NextResponse.json({ error: 'Invalid QStash signature' }, { status: 401 })

  const body = JSON.parse(bodyText || '{}') as { runId?: string }
  if (!body.runId) return NextResponse.json({ error: 'runId is required' }, { status: 400 })

  await processShopLensRun(body.runId)
  return NextResponse.json({ ok: true })
}
