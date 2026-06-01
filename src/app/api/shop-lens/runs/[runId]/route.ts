import { NextResponse } from 'next/server'
import { getRunResult } from '@/lib/shop-lens/agent'
import { progressLabels, type AgentRunState } from '@/lib/shop-lens/types'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: { runId: string } }) {
  const result = await getRunResult(params.runId)
  if (!result.run) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 })
  }

  const currentState = result.run.currentState as AgentRunState
  return NextResponse.json({
    sessionId: result.run.sessionId,
    runId: result.run.id,
    status: result.run.status,
    currentState,
    progressLabel: progressLabels[currentState] ?? 'Working...',
    originalImageUrl: result.originalImageUrl,
    generatedImageUrl: result.generatedImageUrl,
    userPrompt: result.userPrompt,
    sceneDescription: currentState === 'presenting_result' ? result.sceneDescription : undefined,
    generationPrompt: currentState === 'presenting_result' ? result.generationPrompt : undefined,
    products: currentState === 'presenting_result' ? result.products ?? [] : undefined,
    selectedTotalCents: currentState === 'presenting_result' ? result.selectedTotalCents ?? 0 : undefined,
    errorMessage: result.run.errorMessage,
  })
}
