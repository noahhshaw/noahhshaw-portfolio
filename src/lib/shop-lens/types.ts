import { z } from 'zod'

export const SHOP_LENS_MODEL = 'gemini-3-pro-image-preview'
export const SHOP_LENS_MAX_CONTEXT_IMAGES = 14
export const SHOP_LENS_MAX_UPLOADS = 4
export const SHOP_LENS_MAX_UPLOAD_BYTES = 8 * 1024 * 1024
export const SHOP_LENS_DAILY_GENERATION_CAP = 50

export const shopSessionStatusSchema = z.enum(['active', 'completed', 'abandoned', 'failed'])
export const agentRunStatusSchema = z.enum(['queued', 'running', 'completed', 'failed', 'canceled'])
export const agentRunStateSchema = z.enum([
  'queued',
  'planning',
  'searching_products',
  'building_assortment',
  'fetching_product_details',
  'caching_product_images',
  'building_context_bundle',
  'generating_image',
  'presenting_result',
  'failed',
  'canceled',
])
export const runTriggerSchema = z.enum(['initial_prompt', 'user_revision'])
export const imageRoleSchema = z.enum([
  'scene',
  'product_reference',
  'style_reference',
  'generated',
  'prior_draft',
])
export const imageSourceSchema = z.enum([
  'upload',
  'product_search',
  'emergency_catalog',
  'generation',
])
export const aspectRatioSchema = z.enum(['9:16', '4:5'])
export const productRoleSchema = z.enum(['hero', 'supporting', 'alternate'])

export type AgentRunState = z.infer<typeof agentRunStateSchema>
export type AgentRunStatus = z.infer<typeof agentRunStatusSchema>
export type ImageRole = z.infer<typeof imageRoleSchema>
export type ImageSource = z.infer<typeof imageSourceSchema>
export type AspectRatio = z.infer<typeof aspectRatioSchema>
export type ProductRole = z.infer<typeof productRoleSchema>

export const planCategorySchema = z.object({
  name: z.string().min(2),
  priority: z.number().int().min(1),
  desiredCount: z.number().int().min(1).max(8),
  searchQueries: z.array(z.string().min(2)).min(1).max(3),
})

export const designPlanSchema = z.object({
  userGoal: z.string().min(1),
  inferredScenario: z.enum(['room', 'event', 'outfit', 'tablescape', 'outdoor', 'generic']),
  budgetMode: z.enum(['none', 'user_specified', 'inferred']),
  targetBudgetCents: z.number().int().positive().nullable(),
  priceStrategy: z.enum(['best_result', 'cost_sensitive', 'premium', 'mixed']),
  desiredProductCount: z.number().int().min(3).max(18),
  heroProductCount: z.number().int().min(1).max(8),
  generationGoal: z.string().min(1),
  clarificationNeeded: z.boolean(),
  clarificationQuestion: z.string().nullable(),
  categories: z.array(planCategorySchema).min(1).max(8),
})

export type DesignPlanOutput = z.infer<typeof designPlanSchema>

export type ProductSearchResultInput = {
  source: 'serpapi_google_shopping' | 'emergency_catalog'
  externalProductId: string
  title: string
  merchant: string | null
  productUrl: string
  imageUrl: string
  priceText: string | null
  priceCents: number | null
  currency: string
  rating: number | null
  reviewCount: number | null
  rank: number
  rawJson: unknown
}

export type AssortmentProduct = ProductSearchResultInput & {
  assortmentReason: string
}

export type ProductCard = {
  id: string
  title: string
  merchant: string | null
  productUrl: string
  imageUrl: string | null
  priceCents: number | null
  quantity: number
  selected: boolean
  role: ProductRole
}

export const progressLabels: Record<AgentRunState, string> = {
  queued: 'Warming up the design agent...',
  planning: 'Reading your prompt and planning the shopping pass...',
  searching_products: 'Searching live product results...',
  building_assortment: 'Curating a balanced product assortment...',
  fetching_product_details: 'Choosing the best purchasable items...',
  caching_product_images: 'Preparing product images for the model...',
  building_context_bundle: 'Packing scene and product references...',
  generating_image: 'Composing the final scene. This can take a minute...',
  presenting_result: 'Ready.',
  failed: 'Something went sideways.',
  canceled: 'Canceled.',
}
