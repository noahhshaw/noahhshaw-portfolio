'use client'

import { FormEvent, TouchEvent, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'

type RunStatus = {
  sessionId: string
  runId: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'canceled'
  currentState: string
  progressLabel: string
  originalImageUrl?: string
  generatedImageUrl?: string
  userPrompt?: string
  sceneDescription?: string
  generationPrompt?: string
  products?: ProductCard[]
  selectedTotalCents?: number
  errorMessage?: string
}

type ProductCard = {
  id: string
  title: string
  merchant: string | null
  productUrl: string
  imageUrl: string | null
  priceCents: number | null
  quantity: number
  selected: boolean
  role: 'hero' | 'supporting' | 'alternate'
}

type Stage = {
  state: string
  label: string
  detail: string
}

const stages: Stage[] = [
  {
    state: 'planning',
    label: 'Reading the space',
    detail: 'Understanding the photo, prompt, style, scale, and likely constraints.',
  },
  {
    state: 'searching_products',
    label: 'Planning the design',
    detail: 'Choosing product categories, quantities, and visual anchors.',
  },
  {
    state: 'building_assortment',
    label: 'Curating the assortment',
    detail: 'Ranking products, removing near-duplicates, and balancing categories.',
  },
  {
    state: 'fetching_product_details',
    label: 'Searching live products',
    detail: 'Finding real purchasable items from live shopping results.',
  },
  {
    state: 'caching_product_images',
    label: 'Preparing product images',
    detail: 'Normalizing product photos so the image model can use them.',
  },
  {
    state: 'building_context_bundle',
    label: 'Building the scene brief',
    detail: 'Packing the original image and product references for generation.',
  },
  {
    state: 'generating_image',
    label: 'Composing the result',
    detail: 'Generating the new scene with the selected product likenesses.',
  },
  {
    state: 'presenting_result',
    label: 'Building the product set',
    detail: 'Preparing tappable product tiles, selections, and totals.',
  },
]

const useCases = [
  'Party themes',
  'Room makeovers',
  'Patio upgrades',
  'Tablescapes',
  'Shelf styling',
]

const howItWorks = [
  {
    title: 'Upload a scene',
    detail: 'Start with a room, patio, table, shelf, outfit, or anything you want to reimagine.',
  },
  {
    title: 'Describe the makeover',
    detail: 'Ask for a party theme, room refresh, seasonal setup, retail display, or a stranger idea.',
  },
  {
    title: 'Get a shoppable cart',
    detail: 'See a generated visual preview with real product tiles, prices, merchants, and links.',
  },
]

function formatMoney(cents: number | null | undefined): string {
  if (cents == null) return 'Price unavailable'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

function getStageIndex(currentState: string): number {
  if (currentState === 'queued') return 0
  if (currentState === 'failed' || currentState === 'canceled') return 0
  const index = stages.findIndex((stage) => stage.state === currentState)
  return index === -1 ? 0 : index
}

function getRoleLabel(role: ProductCard['role']): string {
  if (role === 'hero') return 'Shown in image'
  if (role === 'supporting') return 'Supporting item'
  return 'Alternative'
}

function getStoredRunId(): string | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    return window.localStorage.getItem('shopLens.runId')
  } catch {
    return null
  }
}

function storeRunId(runId: string) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return
    window.localStorage.setItem('shopLens.runId', runId)
  } catch {
    // Session restore is a convenience; generation still works without storage.
  }
}

function clearStoredRunId() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return
    window.localStorage.removeItem('shopLens.runId')
  } catch {
    // Session restore is a convenience; clearing it should never block the UI.
  }
}

export default function ShopLensClient() {
  const [prompt, setPrompt] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [run, setRun] = useState<RunStatus | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [comparisonMode, setComparisonMode] = useState<'generated' | 'original'>('generated')
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const gestureRef = useRef<{
    distance: number
    zoom: number
    x: number
    y: number
    panX: number
    panY: number
  } | null>(null)
  const startedPollingAt = useRef<number>(0)

  useEffect(() => {
    const restoredRunId = getStoredRunId()
    if (restoredRunId) {
      pollRun(restoredRunId)
    }
  }, [])

  useEffect(() => {
    return () => previews.forEach((url) => URL.revokeObjectURL(url))
  }, [previews])

  useEffect(() => {
    if (!run || ['completed', 'failed', 'canceled'].includes(run.status)) return
    const elapsed = Date.now() - startedPollingAt.current
    const delay = elapsed > 60_000 ? 8000 : 2000
    const timer = window.setTimeout(() => pollRun(run.runId), delay)
    return () => window.clearTimeout(timer)
  }, [run])

  useEffect(() => {
    function onFocus() {
      const runId = getStoredRunId()
      if (runId && (!run || !['completed', 'failed', 'canceled'].includes(run.status))) {
        pollRun(runId)
      }
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [run])

  const selectedTotal = useMemo(() => {
    if (!run?.products) return 0
    return run.products.reduce((sum, product) => {
      return product.selected ? sum + (product.priceCents ?? 0) * product.quantity : sum
    }, 0)
  }, [run?.products])

  const selectedCount = useMemo(() => {
    return run?.products?.filter((product) => product.selected).length ?? 0
  }, [run?.products])

  const stageIndex = getStageIndex(run?.currentState ?? 'queued')
  const progressPercent = run?.status === 'completed'
    ? 100
    : Math.max(8, Math.round(((stageIndex + 1) / stages.length) * 100))
  const originalImageUrl = run?.originalImageUrl ?? previews[0]
  const resultImageUrl = comparisonMode === 'original' && originalImageUrl
    ? originalImageUrl
    : run?.generatedImageUrl
  const canShowOriginal = Boolean(originalImageUrl)

  async function pollRun(runId: string) {
    const response = await fetch(`/api/shop-lens/runs/${runId}`, { cache: 'no-store' })
    if (!response.ok) return
    const data = await response.json() as RunStatus
    setRun(data)
  }

  function handleFiles(nextFiles: FileList | null) {
    const incoming = Array.from(nextFiles ?? []).slice(0, 4)
    previews.forEach((url) => URL.revokeObjectURL(url))
    setFiles(incoming)
    setPreviews(incoming.map((file) => URL.createObjectURL(file)))
    setComparisonMode('generated')
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (!prompt.trim()) {
      setError('Describe what you want to create.')
      return
    }
    if (!files.length) {
      setError('Add at least one photo.')
      return
    }

    const formData = new FormData()
    formData.set('prompt', prompt.trim())
    files.forEach((file) => formData.append('images', file))

    setSubmitting(true)
    try {
      const response = await fetch('/api/shop-lens/runs', {
        method: 'POST',
        body: formData,
      })
      const data = await response.json().catch(() => ({ error: 'Could not start Shop Lens.' }))
      if (!response.ok) {
        throw new Error(data.error ?? 'Could not start Shop Lens.')
      }
      storeRunId(data.runId)
      startedPollingAt.current = Date.now()
      setRun({
        sessionId: data.sessionId,
        runId: data.runId,
        status: 'queued',
        currentState: 'queued',
        progressLabel: 'Warming up the design agent...',
      })
      pollRun(data.runId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start Shop Lens.')
    } finally {
      setSubmitting(false)
    }
  }

  async function updateSelection(product: ProductCard, selected: boolean) {
    if (!run) return
    const nextProducts = run.products?.map((item) => (
      item.id === product.id ? { ...item, selected } : item
    ))
    setRun({ ...run, products: nextProducts })
    await fetch('/api/shop-lens/selections', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        updates: [{ productCandidateId: product.id, selected, quantity: product.quantity }],
      }),
    })
  }

  async function cancelRun() {
    if (!run || ['completed', 'failed', 'canceled'].includes(run.status)) return
    await fetch(`/api/shop-lens/runs/${run.runId}/cancel`, { method: 'POST' })
    pollRun(run.runId)
  }

  function resetZoom() {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  function changeZoom(delta: number) {
    setZoom((current) => {
      const next = Math.min(3, Math.max(1, Number((current + delta).toFixed(2))))
      if (next === 1) setPan({ x: 0, y: 0 })
      return next
    })
  }

  function startNewDesign() {
    clearStoredRunId()
    resetZoom()
    setRun(null)
    setComparisonMode('generated')
  }

  function getTouchDistance(event: TouchEvent<HTMLDivElement>) {
    const [first, second] = Array.from(event.touches)
    if (!first || !second) return 0
    return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY)
  }

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    if (event.touches.length === 2) {
      gestureRef.current = {
        distance: getTouchDistance(event),
        zoom,
        x: 0,
        y: 0,
        panX: pan.x,
        panY: pan.y,
      }
      return
    }

    const first = event.touches[0]
    if (first && zoom > 1) {
      gestureRef.current = {
        distance: 0,
        zoom,
        x: first.clientX,
        y: first.clientY,
        panX: pan.x,
        panY: pan.y,
      }
    }
  }

  function handleTouchMove(event: TouchEvent<HTMLDivElement>) {
    if (!gestureRef.current) return
    if (event.touches.length === 2) {
      event.preventDefault()
      const distance = getTouchDistance(event)
      const nextZoom = Math.min(3, Math.max(1, gestureRef.current.zoom * (distance / gestureRef.current.distance)))
      setZoom(nextZoom)
      if (nextZoom === 1) setPan({ x: 0, y: 0 })
      return
    }

    const first = event.touches[0]
    if (first && zoom > 1) {
      event.preventDefault()
      setPan({
        x: gestureRef.current.panX + first.clientX - gestureRef.current.x,
        y: gestureRef.current.panY + first.clientY - gestureRef.current.y,
      })
    }
  }

  function handleTouchEnd() {
    gestureRef.current = null
    if (zoom <= 1.02) resetZoom()
  }

  return (
    <main className="min-h-screen bg-[#f7f3ec] text-charcoal">
      <div className="mx-auto flex min-h-screen w-full max-w-[1120px] flex-col px-4 pb-8 pt-4 sm:px-6 lg:px-8">
        <header className="mb-4 flex items-center justify-between">
          <Link href="/" className="text-sm font-semibold text-slate-600">
            Noah Shaw
          </Link>
        </header>

        {!run && (
          <section className="mx-auto grid w-full max-w-[1040px] flex-1 gap-6 py-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(420px,1fr)] lg:items-start lg:py-14">
            <div className="space-y-7 lg:sticky lg:top-8">
              <div className="space-y-5">
                <div className="inline-flex items-center gap-2 rounded-full border border-teal/20 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-teal-dark shadow-sm">
                  <span className="h-2 w-2 rounded-full bg-teal" />
                  SceneShop
                </div>
                <div className="space-y-4">
                  <h1 className="max-w-[11ch] text-5xl font-semibold leading-[0.96] tracking-normal text-charcoal sm:text-6xl lg:text-7xl">
                    Shop the scene you imagine.
                  </h1>
                  <p className="max-w-xl text-lg leading-8 text-slate-700">
                    Upload a photo, describe the transformation, and get a purchasable visual draft composed from real product results.
                  </p>
                </div>
              </div>

            </div>

            <form onSubmit={submit} className="space-y-4 rounded-lg border border-black/10 bg-white p-3 shadow-lg shadow-slate-900/5">
              <div className="rounded-md border border-black/10 bg-[#fbfaf7] p-4">
                <p className="text-sm font-semibold text-charcoal">Create a shoppable visual draft</p>
                <p className="mt-1 text-sm leading-5 text-slate-600">
                  Add a scene image, then tell the agent what to find and place into it.
                </p>
              </div>
              <label className="block cursor-pointer">
                <span className="sr-only">Photos</span>
                <input
                  className="sr-only"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  multiple
                  onChange={(event) => handleFiles(event.target.files)}
                />
                <div className="flex min-h-40 items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center transition hover:border-teal/50 hover:bg-teal/5">
                  {previews.length > 0 ? (
                    <div className="grid w-full grid-cols-4 gap-2">
                      {previews.map((preview, index) => (
                        <img
                          key={preview}
                          src={preview}
                          alt={`Uploaded reference ${index + 1}`}
                          className="aspect-[3/4] rounded-md object-cover"
                        />
                      ))}
                    </div>
                  ) : (
                    <div>
                      <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-white text-xl shadow-sm">
                        +
                      </div>
                      <p className="text-sm font-semibold text-slate-800">1. Upload up to 4 scene images</p>
                      <p className="mt-1 text-xs text-slate-500">Room, patio, outfit, table, shelf, or anything you want reimagined.</p>
                    </div>
                  )}
                </div>
              </label>

              <label className="block">
                <span className="sr-only">Prompt</span>
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  rows={5}
                  placeholder="2. Describe the makeover. Try: Make this living room feel like a moody cocktail lounge with real furniture, lighting, and tableware."
                  className="w-full resize-none rounded-md border border-slate-200 bg-white p-4 text-base leading-6 outline-none ring-teal/0 transition placeholder:text-slate-400 focus:border-teal focus:ring-2 focus:ring-teal/20"
                />
              </label>

              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="h-12 w-full rounded-md bg-charcoal text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {submitting ? 'Starting...' : 'Start Imagining'}
              </button>
            </form>

            <div className="grid gap-3 sm:grid-cols-3 lg:col-span-2">
              {howItWorks.map((step, index) => (
                <div key={step.title} className="flex gap-3 rounded-lg border border-black/10 bg-white/70 p-4 shadow-sm backdrop-blur">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-charcoal text-sm font-bold text-white">
                    {index + 1}
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-charcoal">{step.title}</h2>
                    <p className="mt-1 text-sm leading-5 text-slate-600">{step.detail}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3 lg:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Try it for
              </p>
              <div className="flex flex-wrap gap-2">
                {useCases.map((useCase) => (
                  <span
                    key={useCase}
                    className="rounded-full border border-teal/20 bg-teal/10 px-3 py-1.5 text-xs font-semibold text-teal-dark"
                  >
                    {useCase}
                  </span>
                ))}
              </div>
            </div>
          </section>
        )}

        {run && run.status !== 'completed' && (
          <section className="mx-auto flex w-full max-w-[560px] flex-1 flex-col justify-center gap-5 py-8">
            <div className="space-y-3">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-dark">
                Generating
              </p>
              <h1 className="text-3xl font-semibold leading-tight">
                {run.progressLabel}
              </h1>
              <p className="text-sm leading-6 text-slate-600">
                This can take a few minutes. You can leave this tab open and the result will keep polling when you return.
              </p>
            </div>

            {originalImageUrl && (
              <img
                src={originalImageUrl}
                alt="Original uploaded scene"
                className="aspect-[9/16] max-h-[360px] w-full rounded-lg border border-black/10 bg-white object-cover shadow-sm"
              />
            )}

            <div className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Generation flow</p>
                  <p className="mt-1 text-xs text-slate-500">{progressPercent}% complete</p>
                </div>
                {!['failed', 'canceled'].includes(run.status) && (
                  <button
                    type="button"
                    onClick={cancelRun}
                    className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600"
                  >
                    Cancel
                  </button>
                )}
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-teal transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <ol className="mt-4 space-y-3">
                {stages.map((stage, index) => {
                  const isDone = index < stageIndex || run.currentState === 'presenting_result'
                  const isActive = index === stageIndex && !['failed', 'canceled'].includes(run.status)
                  return (
                    <li key={stage.state} className="flex gap-3">
                      <div
                        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          isDone
                            ? 'bg-teal text-white'
                            : isActive
                              ? 'border border-teal bg-teal/10 text-teal-dark'
                              : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {isDone ? '✓' : index + 1}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{stage.label}</p>
                        <p className="text-xs leading-5 text-slate-500">{stage.detail}</p>
                      </div>
                    </li>
                  )
                })}
              </ol>
              {run.errorMessage && (
                <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {run.errorMessage}
                </p>
              )}
            </div>
          </section>
        )}

        {run?.status === 'completed' && (
          <section className="mx-auto grid w-full max-w-[1040px] gap-5 pb-6 pt-2 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-dark">Result</p>
                  <h1 className="text-2xl font-semibold">Your shoppable design</h1>
                </div>
                <button
                  type="button"
                  onClick={startNewDesign}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                >
                  New
                </button>
              </div>

              <div className="overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm">
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 p-2">
                  <div className="flex rounded-md bg-slate-100 p-1">
                    <button
                      type="button"
                      onClick={() => {
                        setComparisonMode('generated')
                        resetZoom()
                      }}
                      className={`rounded px-3 py-1.5 text-xs font-semibold ${
                        comparisonMode === 'generated' ? 'bg-white text-charcoal shadow-sm' : 'text-slate-500'
                      }`}
                    >
                      New design
                    </button>
                    <button
                      type="button"
                      disabled={!canShowOriginal}
                      onClick={() => {
                        setComparisonMode('original')
                        resetZoom()
                      }}
                      className={`rounded px-3 py-1.5 text-xs font-semibold disabled:opacity-40 ${
                        comparisonMode === 'original' ? 'bg-white text-charcoal shadow-sm' : 'text-slate-500'
                      }`}
                    >
                      Original
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => changeZoom(-0.25)}
                      className="flex h-8 w-8 items-center justify-center rounded bg-slate-100 text-base font-semibold text-slate-700 disabled:opacity-40"
                      disabled={zoom <= 1}
                      aria-label="Zoom out"
                    >
                      -
                    </button>
                    <button
                      type="button"
                      onClick={() => changeZoom(0.25)}
                      className="flex h-8 w-8 items-center justify-center rounded bg-slate-100 text-base font-semibold text-slate-700 disabled:opacity-40"
                      disabled={zoom >= 3}
                      aria-label="Zoom in"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div
                  className="relative flex aspect-[9/16] max-h-[76vh] touch-none items-center justify-center overflow-hidden bg-slate-100"
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  onDoubleClick={() => {
                    if (zoom > 1) resetZoom()
                    else setZoom(2)
                  }}
                >
                  {resultImageUrl ? (
                    <img
                      src={resultImageUrl}
                      alt={comparisonMode === 'original' ? 'Original uploaded scene' : 'Generated shoppable design'}
                      className="h-full w-full object-cover transition-transform duration-150"
                      style={{
                        transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
                      }}
                    />
                  ) : (
                    <div className="px-6 text-center text-sm text-slate-500">
                      Generated image unavailable.
                    </div>
                  )}
                  <div className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white">
                    Pinch, double tap, or use zoom controls
                  </div>
                </div>
              </div>
            </div>

            <aside className="space-y-3 lg:sticky lg:top-4">
              <div className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-dark">
                  Design brief
                </p>
                {run.sceneDescription && (
                  <p className="mt-3 text-sm leading-6 text-slate-700">
                    {run.sceneDescription}
                  </p>
                )}
                {run.userPrompt && (
                  <div className="mt-3 rounded-md bg-slate-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Original ask
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-700">{run.userPrompt}</p>
                  </div>
                )}
                {run.generationPrompt && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs font-semibold text-slate-500">
                      Generation prompt
                    </summary>
                    <p className="mt-2 max-h-40 overflow-auto rounded-md bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                      {run.generationPrompt}
                    </p>
                  </details>
                )}
              </div>

              <div className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Selected
                    </p>
                    <h2 className="mt-1 text-xl font-semibold">{selectedCount} items</h2>
                  </div>
                  <p className="text-lg font-semibold">{formatMoney(selectedTotal)}</p>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Toggle products to shape what you actually want to procure.
                </p>
              </div>

              {run.products && run.products.length > 0 && (
                <div className="space-y-2">
                  {run.products.map((product) => (
                    <article
                      key={product.id}
                      onClick={(event) => {
                        const target = event.target as HTMLElement
                        if (target.closest('a,button,input,label')) return
                        window.open(product.productUrl, '_blank', 'noopener,noreferrer')
                      }}
                      className={`grid grid-cols-[86px_1fr] gap-3 rounded-lg border bg-white p-2 shadow-sm transition ${
                        product.selected ? 'border-black/10' : 'border-slate-200 opacity-60'
                      } cursor-pointer`}
                    >
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt=""
                          className="h-[86px] w-[86px] rounded-md object-cover"
                        />
                      ) : (
                        <div className="h-[86px] w-[86px] rounded-md bg-slate-100" />
                      )}
                      <div className="min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="line-clamp-2 text-sm font-semibold leading-5">
                            {product.title}
                          </h3>
                          <label className="relative flex h-7 w-11 shrink-0 items-center">
                            <span className="sr-only">Select {product.title}</span>
                            <input
                              type="checkbox"
                              checked={product.selected}
                              onChange={(event) => updateSelection(product, event.target.checked)}
                              className="peer sr-only"
                            />
                            <span className="h-6 w-11 rounded-full bg-slate-200 transition peer-checked:bg-teal" />
                            <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition peer-checked:translate-x-5" />
                          </label>
                        </div>
                        <p className="mt-1 truncate text-xs text-slate-500">{product.merchant ?? 'Example merchant'}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-semibold">{formatMoney(product.priceCents)}</span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                            {getRoleLabel(product.role)}
                          </span>
                          {product.quantity > 1 && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                              Qty {product.quantity}
                            </span>
                          )}
                        </div>
                        <a
                          href={product.productUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex text-xs font-semibold text-teal-dark"
                        >
                          Open product
                        </a>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </aside>
          </section>
        )}
      </div>
    </main>
  )
}
