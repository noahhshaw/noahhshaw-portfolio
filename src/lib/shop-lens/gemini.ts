import { GoogleGenAI, Modality, Type } from '@google/genai'
import { readShopLensObject, storeShopLensObject } from './storage'
import { makeShopLensObjectKey } from './image'
import { SHOP_LENS_MODEL, type DesignPlanOutput, designPlanSchema } from './types'
import { PLANNER_PROMPT } from './prompts'

let client: GoogleGenAI | null = null

function hasGeminiConfig(): boolean {
  return !!(
    process.env.GOOGLE_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENAI_USE_ENTERPRISE
  )
}

function getClient(): GoogleGenAI {
  if (client) return client
  if (process.env.GOOGLE_GENAI_USE_ENTERPRISE === 'true') {
    client = new GoogleGenAI({
      enterprise: true,
      project: process.env.GOOGLE_CLOUD_PROJECT,
      location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1',
    })
  } else {
    client = new GoogleGenAI({
      apiKey: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY,
    })
  }
  return client
}

function heuristicPlan(userPrompt: string): DesignPlanOutput {
  const lower = userPrompt.toLowerCase()
  const inferredScenario = lower.includes('room') || lower.includes('living')
    ? 'room'
    : lower.includes('party') || lower.includes('backyard')
      ? 'event'
      : lower.includes('outfit')
        ? 'outfit'
        : 'generic'
  const categories = inferredScenario === 'room'
    ? [
        { name: 'statement furniture', priority: 1, desiredCount: 3, searchQueries: [`${userPrompt} furniture`, 'accent chair side table lamp'] },
        { name: 'decor accents', priority: 2, desiredCount: 4, searchQueries: [`${userPrompt} decor`, 'throw pillows wall art rug'] },
      ]
    : [
        { name: 'hero decor', priority: 1, desiredCount: 4, searchQueries: [`${userPrompt} decor`, `${userPrompt} decorations`] },
        { name: 'lighting and accessories', priority: 2, desiredCount: 4, searchQueries: [`${userPrompt} lighting accessories`, `${userPrompt} supplies`] },
      ]

  return {
    userGoal: userPrompt,
    inferredScenario,
    budgetMode: /\$\d+|budget|cheap|affordable|under/i.test(userPrompt) ? 'inferred' : 'none',
    targetBudgetCents: null,
    priceStrategy: /cheap|affordable|budget|reduce/i.test(userPrompt) ? 'cost_sensitive' : 'best_result',
    desiredProductCount: 8,
    heroProductCount: 5,
    generationGoal: `Create a compelling purchasable visual design for: ${userPrompt}`,
    clarificationNeeded: false,
    clarificationQuestion: null,
    categories,
  }
}

function normalizeEnum(value: unknown, allowed: string[], fallback: string): string {
  if (typeof value !== 'string') return fallback
  const normalized = value.toLowerCase().trim().replace(/[\s-]+/g, '_')
  return allowed.includes(normalized) ? normalized : fallback
}

function normalizePlannerOutput(raw: unknown, userPrompt: string): DesignPlanOutput {
  const fallback = heuristicPlan(userPrompt)
  const input = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  const categoriesInput = Array.isArray(input.categories) ? input.categories : fallback.categories
  const categories = categoriesInput.slice(0, 8).map((category, index) => {
    const item = category && typeof category === 'object' ? category as Record<string, unknown> : {}
    const name = typeof item.name === 'string' && item.name.trim()
      ? item.name.trim()
      : fallback.categories[index % fallback.categories.length].name
    const rawQueries = Array.isArray(item.searchQueries)
      ? item.searchQueries
      : Array.isArray(item.search_queries)
        ? item.search_queries
        : [name]
    const searchQueries = rawQueries
      .filter((query): query is string => typeof query === 'string' && query.trim().length > 1)
      .map((query) => query.trim())
      .slice(0, 3)
    return {
      name,
      priority: typeof item.priority === 'number' ? Math.max(1, Math.round(item.priority)) : index + 1,
      desiredCount: typeof item.desiredCount === 'number'
        ? Math.min(8, Math.max(1, Math.round(item.desiredCount)))
        : typeof item.desired_count === 'number'
          ? Math.min(8, Math.max(1, Math.round(item.desired_count)))
          : 3,
      searchQueries: searchQueries.length ? searchQueries : [name],
    }
  })

  const desiredProductCount = typeof input.desiredProductCount === 'number'
    ? Math.min(18, Math.max(3, Math.round(input.desiredProductCount)))
    : typeof input.desired_product_count === 'number'
      ? Math.min(18, Math.max(3, Math.round(input.desired_product_count)))
      : fallback.desiredProductCount
  const heroProductCount = typeof input.heroProductCount === 'number'
    ? Math.min(8, Math.max(1, Math.round(input.heroProductCount)))
    : typeof input.hero_product_count === 'number'
      ? Math.min(8, Math.max(1, Math.round(input.hero_product_count)))
      : fallback.heroProductCount

  return designPlanSchema.parse({
    userGoal: typeof input.userGoal === 'string' ? input.userGoal : userPrompt,
    inferredScenario: normalizeEnum(input.inferredScenario, ['room', 'event', 'outfit', 'tablescape', 'outdoor', 'generic'], fallback.inferredScenario),
    budgetMode: normalizeEnum(input.budgetMode, ['none', 'user_specified', 'inferred'], fallback.budgetMode),
    targetBudgetCents: typeof input.targetBudgetCents === 'number' && input.targetBudgetCents > 0
      ? Math.round(input.targetBudgetCents)
      : null,
    priceStrategy: normalizeEnum(input.priceStrategy, ['best_result', 'cost_sensitive', 'premium', 'mixed'], fallback.priceStrategy),
    desiredProductCount,
    heroProductCount: Math.min(heroProductCount, desiredProductCount),
    generationGoal: typeof input.generationGoal === 'string' ? input.generationGoal : fallback.generationGoal,
    clarificationNeeded: typeof input.clarificationNeeded === 'boolean' ? input.clarificationNeeded : false,
    clarificationQuestion: typeof input.clarificationQuestion === 'string' ? input.clarificationQuestion : null,
    categories,
  })
}

export async function planWithGemini(userPrompt: string, imageCount: number): Promise<DesignPlanOutput> {
  if (!hasGeminiConfig()) return heuristicPlan(userPrompt)

  const response = await getClient().models.generateContent({
    model: process.env.SHOP_LENS_PLANNER_MODEL || 'gemini-2.5-pro',
    contents: `${PLANNER_PROMPT}\n\nUser prompt: ${userPrompt}\nUploaded image count: ${imageCount}`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          userGoal: { type: Type.STRING },
          inferredScenario: { type: Type.STRING },
          budgetMode: { type: Type.STRING },
          targetBudgetCents: { type: Type.INTEGER, nullable: true },
          priceStrategy: { type: Type.STRING },
          desiredProductCount: { type: Type.INTEGER },
          heroProductCount: { type: Type.INTEGER },
          generationGoal: { type: Type.STRING },
          clarificationNeeded: { type: Type.BOOLEAN },
          clarificationQuestion: { type: Type.STRING, nullable: true },
          categories: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                priority: { type: Type.INTEGER },
                desiredCount: { type: Type.INTEGER },
                searchQueries: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
              required: ['name', 'priority', 'desiredCount', 'searchQueries'],
            },
          },
        },
        required: [
          'userGoal',
          'inferredScenario',
          'budgetMode',
          'priceStrategy',
          'desiredProductCount',
          'heroProductCount',
          'generationGoal',
          'clarificationNeeded',
          'categories',
        ],
      },
    },
  })

  const text = response.text
  if (!text) throw new Error('Gemini planner returned no text')
  return normalizePlannerOutput(JSON.parse(text), userPrompt)
}

async function imageAssetToInlinePart(asset: {
  storageUrl: string
  originalUrl: string | null
  mimeType: string
  metadataJson: unknown
}) {
  const metadata = asset.metadataJson as { r2Key?: string } | null
  let bytes: Buffer
  if (metadata?.r2Key) {
    bytes = await readShopLensObject(metadata.r2Key)
  } else {
    const source = asset.storageUrl.startsWith('http') ? asset.storageUrl : asset.originalUrl
    if (!source) throw new Error('Image asset has no readable source')
    const response = await fetch(source)
    if (!response.ok) throw new Error(`Failed to read image source: ${response.status}`)
    bytes = Buffer.from(await response.arrayBuffer())
  }

  return {
    inlineData: {
      mimeType: asset.mimeType || 'image/jpeg',
      data: bytes.toString('base64'),
    },
  }
}

function placeholderSvg(prompt: string): Buffer {
  const safePrompt = prompt
    .replace(/[<>&]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[char] ?? char))
    .slice(0, 220)
  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
  <rect width="1080" height="1920" fill="#f7f3ec"/>
  <rect x="72" y="112" width="936" height="1230" rx="42" fill="#ffffff" stroke="#1a1a1a" stroke-width="4"/>
  <circle cx="540" cy="520" r="210" fill="#99f6e4"/>
  <rect x="194" y="910" width="692" height="190" rx="24" fill="#1a1a1a"/>
  <text x="540" y="990" text-anchor="middle" font-family="Arial, sans-serif" font-size="42" fill="#ffffff">Shop Lens Preview</text>
  <text x="540" y="1060" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" fill="#ffffff">Configure Gemini to generate final scenes</text>
  <text x="110" y="1460" font-family="Arial, sans-serif" font-size="36" fill="#1a1a1a">Prompt</text>
  <foreignObject x="110" y="1500" width="860" height="260">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Arial, sans-serif; font-size: 30px; line-height: 1.35; color: #334155;">${safePrompt}</div>
  </foreignObject>
</svg>`)
}

export async function generateWithGemini(opts: {
  prompt: string
  imageAssets: Array<{
    storageUrl: string
    originalUrl: string | null
    mimeType: string
    metadataJson: unknown
  }>
}): Promise<{
  bytes: Buffer
  contentType: string
  rawResponse: unknown
  model: string
}> {
  const model = process.env.SHOP_LENS_IMAGE_MODEL || SHOP_LENS_MODEL
  if (!hasGeminiConfig()) {
    return {
      bytes: placeholderSvg(opts.prompt),
      contentType: 'image/svg+xml',
      rawResponse: { skipped: 'Gemini credentials not configured' },
      model,
    }
  }

  const imageParts = await Promise.all(opts.imageAssets.map(imageAssetToInlinePart))
  const response = await getClient().models.generateContent({
    model,
    contents: [{
      role: 'user',
      parts: [
        { text: opts.prompt },
        ...imageParts,
      ],
    }],
    config: {
      responseModalities: [Modality.TEXT, Modality.IMAGE],
    },
  })

  if (!response.data) {
    throw new Error('Gemini image generation returned no image data')
  }

  return {
    bytes: Buffer.from(response.data, 'base64'),
    contentType: 'image/png',
    rawResponse: {
      responseId: response.responseId,
      modelVersion: response.modelVersion,
      usageMetadata: response.usageMetadata,
    },
    model,
  }
}

export async function storeGeneratedImage(sessionId: string, bytes: Buffer, contentType: string) {
  const extension = contentType === 'image/svg+xml' ? 'svg' : 'png'
  const key = makeShopLensObjectKey(`generated/${sessionId}`, extension)
  return storeShopLensObject({ key, bytes, contentType })
}
