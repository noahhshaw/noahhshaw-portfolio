import type { AssortmentProduct, DesignPlanOutput, ProductSearchResultInput } from './types'

type ResultMeta = {
  planCategoryId?: string
  categoryName?: string
  query?: string
}

const stopWords = new Set([
  'a',
  'an',
  'and',
  'by',
  'for',
  'in',
  'of',
  'on',
  'set',
  'the',
  'to',
  'with',
])

function getMeta(result: ProductSearchResultInput): ResultMeta {
  return result.rawJson && typeof result.rawJson === 'object'
    ? result.rawJson as ResultMeta
    : {}
}

function titleTokens(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2 && !stopWords.has(token) && !/^\d+(ct|pc|ft|in)?$/.test(token))
}

function familyKey(title: string, query: string | undefined): string {
  const tokens = titleTokens(`${query ?? ''} ${title}`)
  return Array.from(new Set(tokens)).slice(0, 4).join(' ')
}

function similarity(left: string, right: string): number {
  const a = new Set(titleTokens(left))
  const b = new Set(titleTokens(right))
  if (!a.size || !b.size) return 0
  const intersection = Array.from(a).filter((token) => b.has(token)).length
  return intersection / Math.min(a.size, b.size)
}

function scoreResult(result: ProductSearchResultInput): number {
  let score = 100 - result.rank
  if (result.priceCents != null) score += 12
  if (result.imageUrl) score += 10
  if (result.merchant) score += 8
  if (result.rating != null) score += Math.min(8, result.rating / 10)
  if (result.reviewCount != null) score += Math.min(8, Math.log10(result.reviewCount + 1) * 3)
  return score
}

function isTooSimilar(candidate: ProductSearchResultInput, selected: ProductSearchResultInput[]) {
  const candidateMeta = getMeta(candidate)
  return selected.some((item) => {
    const itemMeta = getMeta(item)
    if (candidateMeta.query && itemMeta.query && candidateMeta.query === itemMeta.query) {
      return true
    }
    if (familyKey(candidate.title, candidateMeta.query) === familyKey(item.title, itemMeta.query)) {
      return true
    }
    return similarity(candidate.title, item.title) >= 0.62
  })
}

function categoryLimit(plan: DesignPlanOutput) {
  return Math.max(1, Math.ceil(plan.desiredProductCount / Math.max(1, plan.categories.length)))
}

export function curateAssortment(
  results: ProductSearchResultInput[],
  plan: DesignPlanOutput
): AssortmentProduct[] {
  const sorted = [...results].sort((a, b) => scoreResult(b) - scoreResult(a))
  const selected: ProductSearchResultInput[] = []
  const selectedByCategory = new Map<string, number>()
  const selectedByQuery = new Map<string, number>()
  const maxPerCategory = categoryLimit(plan)
  const maxPerQuery = 2

  function canAdd(result: ProductSearchResultInput, strict: boolean): boolean {
    const meta = getMeta(result)
    const categoryId = meta.planCategoryId ?? meta.categoryName ?? 'uncategorized'
    const query = meta.query ?? result.title
    if ((selectedByCategory.get(categoryId) ?? 0) >= maxPerCategory) return false
    if ((selectedByQuery.get(query) ?? 0) >= maxPerQuery) return false
    if (strict && isTooSimilar(result, selected)) return false
    return true
  }

  function add(result: ProductSearchResultInput) {
    const meta = getMeta(result)
    const categoryId = meta.planCategoryId ?? meta.categoryName ?? 'uncategorized'
    const query = meta.query ?? result.title
    selected.push(result)
    selectedByCategory.set(categoryId, (selectedByCategory.get(categoryId) ?? 0) + 1)
    selectedByQuery.set(query, (selectedByQuery.get(query) ?? 0) + 1)
  }

  const queries = Array.from(new Set(results.map((result) => getMeta(result).query).filter(Boolean)))
  for (const query of queries) {
    const bestForQuery = sorted.find((result) => getMeta(result).query === query && canAdd(result, true))
    if (bestForQuery) add(bestForQuery)
  }

  for (const result of sorted) {
    if (selected.length >= plan.desiredProductCount) break
    if (selected.includes(result)) continue
    if (canAdd(result, true)) add(result)
  }

  for (const result of sorted) {
    if (selected.length >= plan.desiredProductCount) break
    if (selected.includes(result)) continue
    if (canAdd(result, false)) add(result)
  }

  return selected.slice(0, plan.desiredProductCount).map((result, index) => ({
    ...result,
    assortmentReason: index < plan.heroProductCount
      ? 'Visual anchor for the generated scene'
      : 'Selected to keep the purchasable set varied and on-theme',
  }))
}
