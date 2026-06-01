import { and, eq, inArray } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { shopLensDb as db } from '@/db'
import { agentRuns, runEvents } from '@/db/schema'

export const dynamic = 'force-dynamic'

export async function POST(_request: Request, { params }: { params: { runId: string } }) {
  const rows = await db
    .update(agentRuns)
    .set({ status: 'canceled', currentState: 'canceled', completedAt: new Date() })
    .where(and(eq(agentRuns.id, params.runId), inArray(agentRuns.status, ['queued', 'running'])))
    .returning({ id: agentRuns.id, sessionId: agentRuns.sessionId })

  const run = rows.find((row) => row.id === params.runId)
  if (!run) {
    const [existing] = await db.select().from(agentRuns).where(eq(agentRuns.id, params.runId)).limit(1)
    if (!existing) return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    return NextResponse.json({ status: existing.status })
  }

  await db.insert(runEvents).values({
    sessionId: run.sessionId,
    runId: run.id,
    eventType: 'canceled',
    fromState: null,
    toState: 'canceled',
    message: 'User canceled run',
    metadataJson: {},
  })

  return NextResponse.json({ status: 'canceled' })
}
