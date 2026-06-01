import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { shopLensDb as db } from '@/db'
import { itemSelections } from '@/db/schema'

export const dynamic = 'force-dynamic'

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const updates = Array.isArray(body?.updates) ? body.updates : []
  if (!updates.length) {
    return NextResponse.json({ error: 'No selection updates provided' }, { status: 400 })
  }

  for (const update of updates) {
    if (typeof update.productCandidateId !== 'string') continue
    await db.update(itemSelections).set({
      selected: Boolean(update.selected),
      quantity: Math.max(1, Number(update.quantity) || 1),
      updatedAt: new Date(),
    }).where(eq(itemSelections.productCandidateId, update.productCandidateId))
  }

  return NextResponse.json({ ok: true })
}
