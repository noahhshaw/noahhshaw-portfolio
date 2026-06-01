import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { shopLensDb as db } from '@/db'
import {
  agentRuns,
  contextBundleItems,
  contextBundles,
  costEvents,
  designPlans,
  generationAttempts,
  imageAssets,
  itemSelections,
  planCategories,
  productCandidateImages,
  productCandidates,
  productSearchResults,
  productSearches,
  productSources,
  runEvents,
  shopSessions,
} from '@/db/schema'
import { fetchAndNormalizeImage, makeShopLensObjectKey } from './image'
import { shopId } from './ids'
import { curateAssortment } from './assortment'
import { buildGenerationPrompt, buildSceneDescription } from './prompts'
import { dedupeProductResults, fallbackProductResults, searchSerpApiShopping } from './product-search'
import { storeShopLensObject } from './storage'
import {
  SHOP_LENS_MAX_CONTEXT_IMAGES,
  SHOP_LENS_MODEL,
  type AgentRunState,
  type AssortmentProduct,
  type DesignPlanOutput,
  type ProductCard,
  type ProductSearchResultInput,
} from './types'
import { generateWithGemini, planWithGemini, storeGeneratedImage } from './gemini'
import { reserveDailyGenerationSlot } from './caps'

const SERP_SOURCE_ID = 'src_serpapi_google_shopping'
const EMERGENCY_SOURCE_ID = 'src_emergency_catalog'

async function recordEvent(args: {
  sessionId: string
  runId: string
  eventType: string
  fromState?: string | null
  toState?: string | null
  message?: string
  metadata?: unknown
}) {
  await db.insert(runEvents).values({
    sessionId: args.sessionId,
    runId: args.runId,
    eventType: args.eventType,
    fromState: args.fromState ?? null,
    toState: args.toState ?? null,
    message: args.message,
    metadataJson: args.metadata ?? {},
  })
}

async function transitionRun(args: {
  runId: string
  sessionId: string
  from: AgentRunState
  to: AgentRunState
  message: string
}): Promise<boolean> {
  const now = new Date()
  const updates: Partial<typeof agentRuns.$inferInsert> = {
    currentState: args.to,
    status: args.to === 'presenting_result' ? 'completed' : 'running',
  }
  if (args.from === 'queued') updates.startedAt = now
  if (args.to === 'presenting_result') updates.completedAt = now

  const rows = await db
    .update(agentRuns)
    .set(updates)
    .where(and(
      eq(agentRuns.id, args.runId),
      eq(agentRuns.currentState, args.from),
      sql`${agentRuns.status} <> 'canceled'`
    ))
    .returning({ id: agentRuns.id })

  if (!rows.length) return false
  await recordEvent({
    sessionId: args.sessionId,
    runId: args.runId,
    eventType: 'state_transition',
    fromState: args.from,
    toState: args.to,
    message: args.message,
  })
  return true
}

export async function failRun(runId: string, errorCode: string, errorMessage: string) {
  const [run] = await db.select().from(agentRuns).where(eq(agentRuns.id, runId)).limit(1)
  if (!run) return
  await db
    .update(agentRuns)
    .set({
      status: 'failed',
      currentState: 'failed',
      completedAt: new Date(),
      errorCode,
      errorMessage,
    })
    .where(eq(agentRuns.id, runId))
  await recordEvent({
    sessionId: run.sessionId,
    runId,
    eventType: 'failed',
    fromState: run.currentState,
    toState: 'failed',
    message: errorMessage,
    metadata: { errorCode },
  })
}

async function isCanceled(runId: string): Promise<boolean> {
  const [run] = await db.select({ status: agentRuns.status }).from(agentRuns).where(eq(agentRuns.id, runId)).limit(1)
  return run?.status === 'canceled'
}

async function ensureSources() {
  await db.insert(productSources).values([
    { id: SERP_SOURCE_ID, name: 'serpapi_google_shopping', status: 'active', priority: 1 },
    { id: EMERGENCY_SOURCE_ID, name: 'emergency_catalog', status: 'active', priority: 99 },
  ]).onConflictDoNothing()
}

async function createPlan(run: typeof agentRuns.$inferSelect, prompt: string, imageCount: number): Promise<DesignPlanOutput & { id: string }> {
  const plan = await planWithGemini(prompt, imageCount)
  const planId = shopId('plan')
  await db.insert(designPlans).values({
    id: planId,
    sessionId: run.sessionId,
    runId: run.id,
    userGoal: plan.userGoal,
    inferredScenario: plan.inferredScenario,
    budgetMode: plan.budgetMode,
    targetBudgetCents: plan.targetBudgetCents,
    priceStrategy: plan.priceStrategy,
    desiredProductCount: plan.desiredProductCount,
    heroProductCount: plan.heroProductCount,
    generationGoal: plan.generationGoal,
    clarificationNeeded: plan.clarificationNeeded,
    clarificationQuestion: plan.clarificationQuestion,
    planJson: plan,
  })

  await db.insert(planCategories).values(plan.categories.map((category) => ({
    id: shopId('cat'),
    planId,
    name: category.name,
    priority: category.priority,
    desiredCount: category.desiredCount,
    searchQueriesJson: category.searchQueries,
  })))

  return { ...plan, id: planId }
}

async function runProductSearches(run: typeof agentRuns.$inferSelect, planId: string): Promise<ProductSearchResultInput[]> {
  await ensureSources()
  const categories = await db.select().from(planCategories).where(eq(planCategories.planId, planId))
  const allResults: ProductSearchResultInput[] = []

  for (const category of categories) {
    const queries = Array.isArray(category.searchQueriesJson)
      ? category.searchQueriesJson.filter((query): query is string => typeof query === 'string')
      : [category.name]

    for (const query of queries.slice(0, 2)) {
      const searchId = shopId('search')
      let raw: unknown = {}
      let results: ProductSearchResultInput[] = []
      let status = 'succeeded'
      let errorMessage: string | null = null
      try {
        const search = await searchSerpApiShopping(query, category.desiredCount)
        raw = search.raw
        results = search.results
      } catch (error) {
        status = 'failed'
        errorMessage = error instanceof Error ? error.message : 'Search failed'
      }

      await db.insert(productSearches).values({
        id: searchId,
        sessionId: run.sessionId,
        runId: run.id,
        planCategoryId: category.id,
        sourceId: SERP_SOURCE_ID,
        query,
        status,
        rawResponseJson: raw,
        completedAt: new Date(),
        errorMessage,
      })

      if (!results.length) {
        results = fallbackProductResults(query, Math.max(2, category.desiredCount))
      }

      if (results.length) {
        await db.insert(productSearchResults).values(results.map((result) => ({
          id: shopId('psr'),
          productSearchId: searchId,
          source: result.source,
          externalProductId: result.externalProductId,
          title: result.title,
          merchant: result.merchant,
          productUrl: result.productUrl,
          imageUrl: result.imageUrl,
          priceText: result.priceText,
          priceCents: result.priceCents,
          currency: result.currency,
          rating: result.rating,
          reviewCount: result.reviewCount,
          rank: result.rank,
          rawJson: result.rawJson,
        })))
        allResults.push(...results.map((result) => ({
          ...result,
          rawJson: {
            ...(typeof result.rawJson === 'object' && result.rawJson !== null ? result.rawJson : {}),
            planCategoryId: category.id,
            categoryName: category.name,
            query,
          },
        })))
      }
    }
  }

  return dedupeProductResults(allResults)
}

async function promoteCandidates(run: typeof agentRuns.$inferSelect, plan: DesignPlanOutput & { id: string }, results: AssortmentProduct[]) {
  const storedResults = await db
    .select()
    .from(productSearchResults)
    .innerJoin(productSearches, eq(productSearchResults.productSearchId, productSearches.id))
    .where(eq(productSearches.runId, run.id))

  const byExternal = new Map(storedResults.map((row) => [row.product_search_results.externalProductId, row]))
  const categories = await db.select().from(planCategories).where(eq(planCategories.planId, plan.id))
  const fallbackCategoryId = categories[0]?.id
  if (!fallbackCategoryId) throw new Error('Plan has no categories')

  const selected = results.slice(0, plan.desiredProductCount)
  const values = selected.map((result, index) => {
    const stored = byExternal.get(result.externalProductId)
    const raw = result.rawJson as { planCategoryId?: string }
    return {
      id: shopId('pc'),
      sessionId: run.sessionId,
      runId: run.id,
      planCategoryId: raw.planCategoryId ?? fallbackCategoryId,
      productSearchResultId: stored?.product_search_results.id,
      emergencyCatalogItemId: null,
      rank: index + 1,
      role: index < plan.heroProductCount ? 'hero' : 'supporting',
      reason: result.assortmentReason,
      quantity: 1,
      unitPriceCents: result.priceCents,
    }
  })
  if (!values.length) throw new Error('No product candidates available')

  await db.insert(productCandidates).values(values)
  await db.insert(itemSelections).values(values
    .filter((candidate) => candidate.role === 'hero' || candidate.role === 'supporting')
    .map((candidate) => ({
      id: shopId('sel'),
      sessionId: run.sessionId,
      productCandidateId: candidate.id,
      selected: true,
      quantity: candidate.quantity,
    })))

  return values
}

async function cacheCandidateImages(run: typeof agentRuns.$inferSelect) {
  const candidates = await db
    .select()
    .from(productCandidates)
    .innerJoin(productSearchResults, eq(productCandidates.productSearchResultId, productSearchResults.id))
    .where(eq(productCandidates.runId, run.id))

  let position = 0
  for (const row of candidates) {
    const candidate = row.product_candidates
    const result = row.product_search_results
    try {
      const normalized = await fetchAndNormalizeImage(result.imageUrl)
      const key = makeShopLensObjectKey(`products/${run.sessionId}`)
      const stored = await storeShopLensObject({
        key,
        bytes: normalized.bytes,
        contentType: normalized.contentType,
        fallbackUrl: result.imageUrl,
      })
      const assetId = shopId('asset')
      await db.insert(imageAssets).values({
        id: assetId,
        sessionId: run.sessionId,
        role: 'product_reference',
        source: result.source === 'emergency_catalog' ? 'emergency_catalog' : 'product_search',
        storageUrl: stored.storageUrl,
        originalUrl: result.imageUrl,
        mimeType: normalized.contentType,
        width: normalized.width,
        height: normalized.height,
        aspectRatio: normalized.aspectRatio,
        sizeBytes: normalized.bytes.byteLength,
        exifOrientationApplied: false,
        metadataJson: { r2Key: stored.cached ? stored.key : undefined },
      })
      await db.insert(productCandidateImages).values({
        id: shopId('pci'),
        productCandidateId: candidate.id,
        imageAssetId: assetId,
        position: 1,
        selectedForContext: position < SHOP_LENS_MAX_CONTEXT_IMAGES - 1,
      })
      position++
    } catch (error) {
      await recordEvent({
        sessionId: run.sessionId,
        runId: run.id,
        eventType: 'product_image_failed',
        message: `Could not cache image for ${result.title}`,
        metadata: { imageUrl: result.imageUrl, error: error instanceof Error ? error.message : String(error) },
      })
    }
  }
}

async function buildContextBundle(run: typeof agentRuns.$inferSelect, plan: DesignPlanOutput & { id: string }, prompt: string) {
  const sceneImages = await db
    .select()
    .from(imageAssets)
    .where(and(eq(imageAssets.sessionId, run.sessionId), eq(imageAssets.role, 'scene')))

  const productImages = await db
    .select()
    .from(productCandidateImages)
    .innerJoin(imageAssets, eq(productCandidateImages.imageAssetId, imageAssets.id))
    .innerJoin(productCandidates, eq(productCandidateImages.productCandidateId, productCandidates.id))
    .where(eq(productCandidates.runId, run.id))

  const selectedProducts = await db
    .select()
    .from(productCandidates)
    .innerJoin(productSearchResults, eq(productCandidates.productSearchResultId, productSearchResults.id))
    .where(eq(productCandidates.runId, run.id))

  const productForPrompt = selectedProducts.map((row) => ({
    title: row.product_search_results.title,
    merchant: row.product_search_results.merchant,
    role: row.product_candidates.role,
    quantity: row.product_candidates.quantity,
  }))
  const sceneDescription = buildSceneDescription({
    userPrompt: prompt,
    generationGoal: plan.generationGoal,
    products: productForPrompt,
  })

  const promptText = buildGenerationPrompt({
    userPrompt: prompt,
    generationGoal: plan.generationGoal,
    sceneDescription,
    products: productForPrompt,
    aspectRatio: '9:16',
  })

  const imageEntries = [
    ...sceneImages.map((asset, index) => ({ asset, role: 'scene', productCandidateId: null as string | null, position: index })),
    ...productImages.map((row, index) => ({
      asset: row.image_assets,
      role: 'product_reference',
      productCandidateId: row.product_candidates.id,
      position: sceneImages.length + index,
    })),
  ].slice(0, SHOP_LENS_MAX_CONTEXT_IMAGES)

  const bundleId = shopId('bundle')
  await db.insert(contextBundles).values({
    id: bundleId,
    sessionId: run.sessionId,
    runId: run.id,
    designPlanId: plan.id,
    model: process.env.SHOP_LENS_IMAGE_MODEL || SHOP_LENS_MODEL,
    aspectRatio: '9:16',
    promptText,
    imageCount: imageEntries.length,
    bundleJson: {
      imageIds: imageEntries.map((entry) => entry.asset.id),
      productIds: imageEntries.map((entry) => entry.productCandidateId).filter(Boolean),
      sceneDescription,
    },
  })
  await db.insert(contextBundleItems).values(imageEntries.map((entry) => ({
    id: shopId('cbi'),
    contextBundleId: bundleId,
    imageAssetId: entry.asset.id,
    productCandidateId: entry.productCandidateId,
    role: entry.role,
    position: entry.position,
    caption: null,
    includeReason: entry.role === 'scene' ? 'User scene image' : 'Product reference for generation',
  })))

  return { id: bundleId, promptText, imageAssets: imageEntries.map((entry) => entry.asset) }
}

async function generateImage(run: typeof agentRuns.$inferSelect, bundle: Awaited<ReturnType<typeof buildContextBundle>>): Promise<boolean> {
  const cap = await reserveDailyGenerationSlot()
  if (!cap.allowed) {
    throw new Error(`Daily generation cap reached (${cap.count}/${cap.limit})`)
  }

  const attemptId = shopId('gen')
  const inserted = await db
    .insert(generationAttempts)
    .values({
      id: attemptId,
      sessionId: run.sessionId,
      runId: run.id,
      contextBundleId: bundle.id,
      model: process.env.SHOP_LENS_IMAGE_MODEL || SHOP_LENS_MODEL,
      status: 'running',
      attemptNumber: 1,
      inputImageCount: bundle.imageAssets.length,
    })
    .onConflictDoNothing()
    .returning({ id: generationAttempts.id })

  if (!inserted.length) {
    const [existingAttempt] = await db
      .select()
      .from(generationAttempts)
      .where(and(eq(generationAttempts.runId, run.id), eq(generationAttempts.attemptNumber, 1)))
      .limit(1)
    await recordEvent({
      sessionId: run.sessionId,
      runId: run.id,
      eventType: 'duplicate_generation_skipped',
      message: 'Generation attempt already exists for this run',
      metadata: { status: existingAttempt?.status },
    })
    if (existingAttempt?.status === 'succeeded') return true
    if (existingAttempt?.status === 'failed') {
      throw new Error(existingAttempt.errorMessage || 'Generation attempt failed')
    }
    return false
  }

  const started = Date.now()
  try {
    const result = await generateWithGemini({
      prompt: bundle.promptText,
      imageAssets: bundle.imageAssets.map((asset) => ({
        storageUrl: asset.storageUrl,
        originalUrl: asset.originalUrl,
        mimeType: asset.mimeType,
        metadataJson: asset.metadataJson,
      })),
    })
    const stored = await storeGeneratedImage(run.sessionId, result.bytes, result.contentType)
    const assetId = shopId('asset')
    await db.insert(imageAssets).values({
      id: assetId,
      sessionId: run.sessionId,
      role: 'generated',
      source: 'generation',
      storageUrl: stored.storageUrl,
      originalUrl: null,
      mimeType: result.contentType,
      width: result.contentType === 'image/svg+xml' ? 1080 : null,
      height: result.contentType === 'image/svg+xml' ? 1920 : null,
      aspectRatio: '9:16',
      sizeBytes: result.bytes.byteLength,
      exifOrientationApplied: false,
      metadataJson: { r2Key: stored.cached ? stored.key : undefined },
    })
    await db.update(generationAttempts).set({
      status: 'succeeded',
      outputImageAssetId: assetId,
      latencyMs: Date.now() - started,
      rawResponseJson: result.rawResponse,
      completedAt: new Date(),
    }).where(eq(generationAttempts.id, attemptId))
    await db.insert(costEvents).values({
      sessionId: run.sessionId,
      runId: run.id,
      kind: 'generation',
      provider: 'google',
      model: result.model,
      estimatedCostCents: null,
      actualCostCents: null,
      metadataJson: { inputImageCount: bundle.imageAssets.length },
    })
    return true
  } catch (error) {
    await db.update(generationAttempts).set({
      status: 'failed',
      completedAt: new Date(),
      errorCode: 'GENERATION_FAILED',
      errorMessage: error instanceof Error ? error.message : String(error),
    }).where(eq(generationAttempts.id, attemptId))
    throw error
  }
}

export async function processShopLensRun(runId: string) {
  const [run] = await db.select().from(agentRuns).where(eq(agentRuns.id, runId)).limit(1)
  if (!run || run.status === 'canceled') return
  if (run.currentState !== 'queued') return
  const [session] = await db.select().from(shopSessions).where(eq(shopSessions.id, run.sessionId)).limit(1)
  if (!session) throw new Error('Missing Shop Lens session')

  try {
    if (run.currentState === 'queued') {
      const ok = await transitionRun({ runId, sessionId: run.sessionId, from: 'queued', to: 'planning', message: 'Planning request' })
      if (!ok) return
    }
    if (await isCanceled(runId)) return

    const sceneImages = await db.select().from(imageAssets).where(and(eq(imageAssets.sessionId, run.sessionId), eq(imageAssets.role, 'scene')))
    const plan = await createPlan(run, session.currentPrompt, sceneImages.length)

    if (!await transitionRun({ runId, sessionId: run.sessionId, from: 'planning', to: 'searching_products', message: 'Searching products' })) return
    if (await isCanceled(runId)) return
    const results = await runProductSearches(run, plan.id)

    if (!await transitionRun({ runId, sessionId: run.sessionId, from: 'searching_products', to: 'building_assortment', message: 'Curating product assortment' })) return
    if (await isCanceled(runId)) return
    const assortment = curateAssortment(results, plan)

    if (!await transitionRun({ runId, sessionId: run.sessionId, from: 'building_assortment', to: 'fetching_product_details', message: 'Choosing product candidates' })) return
    if (await isCanceled(runId)) return
    await promoteCandidates(run, plan, assortment)

    if (!await transitionRun({ runId, sessionId: run.sessionId, from: 'fetching_product_details', to: 'caching_product_images', message: 'Caching product images' })) return
    if (await isCanceled(runId)) return
    await cacheCandidateImages(run)

    if (!await transitionRun({ runId, sessionId: run.sessionId, from: 'caching_product_images', to: 'building_context_bundle', message: 'Building context bundle' })) return
    if (await isCanceled(runId)) return
    const bundle = await buildContextBundle(run, plan, session.currentPrompt)

    if (!await transitionRun({ runId, sessionId: run.sessionId, from: 'building_context_bundle', to: 'generating_image', message: 'Generating image' })) return
    if (await isCanceled(runId)) return
    const generated = await generateImage(run, bundle)
    if (!generated) return

    await transitionRun({ runId, sessionId: run.sessionId, from: 'generating_image', to: 'presenting_result', message: 'Presenting result' })
  } catch (error) {
    await failRun(runId, 'SHOP_LENS_RUN_FAILED', error instanceof Error ? error.message : String(error))
  }
}

export async function getRunResult(runId: string): Promise<{
  run: typeof agentRuns.$inferSelect | null
  sessionId?: string
  originalImageUrl?: string
  generatedImageUrl?: string
  userPrompt?: string
  generationPrompt?: string
  sceneDescription?: string
  products?: ProductCard[]
  selectedTotalCents?: number
}> {
  const [run] = await db.select().from(agentRuns).where(eq(agentRuns.id, runId)).limit(1)
  if (!run) return { run: null }
  const [session] = await db.select().from(shopSessions).where(eq(shopSessions.id, run.sessionId)).limit(1)
  const [sceneImage] = await db
    .select()
    .from(imageAssets)
    .where(and(eq(imageAssets.sessionId, run.sessionId), eq(imageAssets.role, 'scene')))
    .orderBy(imageAssets.createdAt)
    .limit(1)
  const originalImageUrl = sceneImage ? `/api/shop-lens/assets/${sceneImage.id}` : undefined

  if (run.currentState !== 'presenting_result') {
    return { run, sessionId: run.sessionId, originalImageUrl, userPrompt: session?.currentPrompt }
  }

  const [attempt] = await db
    .select()
    .from(generationAttempts)
    .where(and(eq(generationAttempts.runId, run.id), eq(generationAttempts.status, 'succeeded')))
    .orderBy(desc(generationAttempts.startedAt))
    .limit(1)

  const generatedImageUrl = attempt?.outputImageAssetId
    ? `/api/shop-lens/assets/${attempt.outputImageAssetId}`
    : undefined

  const [bundle] = await db
    .select()
    .from(contextBundles)
    .where(eq(contextBundles.runId, run.id))
    .orderBy(desc(contextBundles.createdAt))
    .limit(1)
  const bundleJson = bundle?.bundleJson as { sceneDescription?: string } | null
  const [plan] = await db
    .select()
    .from(designPlans)
    .where(eq(designPlans.runId, run.id))
    .orderBy(desc(designPlans.createdAt))
    .limit(1)

  const rows = await db
    .select()
    .from(productCandidates)
    .innerJoin(productSearchResults, eq(productCandidates.productSearchResultId, productSearchResults.id))
    .innerJoin(itemSelections, eq(productCandidates.id, itemSelections.productCandidateId))
    .where(eq(productCandidates.runId, run.id))

  const candidateIds = rows.map((row) => row.product_candidates.id)
  const images = candidateIds.length
    ? await db
      .select()
      .from(productCandidateImages)
      .innerJoin(imageAssets, eq(productCandidateImages.imageAssetId, imageAssets.id))
      .where(inArray(productCandidateImages.productCandidateId, candidateIds))
    : []

  const imageByCandidate = new Map(images.map((row) => [row.product_candidate_images.productCandidateId, `/api/shop-lens/assets/${row.image_assets.id}`]))
  const products = rows.map((row): ProductCard => ({
    id: row.product_candidates.id,
    title: row.product_search_results.title,
    merchant: row.product_search_results.merchant,
    productUrl: row.product_search_results.productUrl,
    imageUrl: imageByCandidate.get(row.product_candidates.id) ?? row.product_search_results.imageUrl,
    priceCents: row.product_candidates.unitPriceCents,
    quantity: row.item_selections.quantity,
    selected: row.item_selections.selected,
    role: row.product_candidates.role as ProductCard['role'],
  }))

  const selectedTotalCents = products.reduce((sum, product) => (
    product.selected ? sum + (product.priceCents ?? 0) * product.quantity : sum
  ), 0)
  const sceneDescription = bundleJson?.sceneDescription ?? (plan
    ? buildSceneDescription({
        userPrompt: session?.currentPrompt ?? plan.userGoal,
        generationGoal: plan.generationGoal,
        products: products.map((product) => ({
          title: product.title,
          merchant: product.merchant,
          role: product.role,
          quantity: product.quantity,
        })),
      })
    : undefined)

  return {
    run,
    sessionId: run.sessionId,
    originalImageUrl,
    generatedImageUrl,
    userPrompt: session?.currentPrompt,
    generationPrompt: bundle?.promptText,
    sceneDescription,
    products,
    selectedTotalCents,
  }
}

export async function markStaleShopLensRunsFailed() {
  const cutoff = new Date(Date.now() - 30 * 60 * 1000)
  await db.update(agentRuns).set({
    status: 'failed',
    currentState: 'failed',
    completedAt: new Date(),
    errorCode: 'RUN_TIMEOUT',
    errorMessage: 'Run exceeded the MVP timeout window.',
  }).where(and(
    eq(agentRuns.status, 'running'),
    sql`${agentRuns.startedAt} < ${cutoff}`
  ))
}
