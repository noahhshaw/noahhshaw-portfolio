import { searchEmergencyCatalog } from './emergency-catalog'
import { normalizeUrl, stableHash } from './ids'
import type { ProductSearchResultInput } from './types'

function parsePriceCents(price: unknown): number | null {
  if (typeof price !== 'string') return null
  const match = price.replace(/,/g, '').match(/\$?\s*(\d+(?:\.\d{1,2})?)/)
  if (!match) return null
  return Math.round(Number(match[1]) * 100)
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

export async function searchSerpApiShopping(query: string, limit: number): Promise<{
  results: ProductSearchResultInput[]
  raw: unknown
}> {
  const apiKey = process.env.SERPAPI_API_KEY
  if (!apiKey) return { results: [], raw: { skipped: 'SERPAPI_API_KEY not configured' } }

  const url = new URL('https://serpapi.com/search.json')
  url.searchParams.set('engine', 'google_shopping')
  url.searchParams.set('q', query)
  url.searchParams.set('api_key', apiKey)
  url.searchParams.set('hl', 'en')
  url.searchParams.set('gl', 'us')

  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`SerpApi returned ${response.status}`)
  }

  const raw = await response.json()
  const shoppingResults = Array.isArray(raw.shopping_results)
    ? raw.shopping_results
    : Array.isArray(raw.product_results)
      ? raw.product_results
      : []

  const results = shoppingResults.slice(0, limit).flatMap((item: Record<string, unknown>, index: number) => {
    const title = firstString(item.title, item.name)
    const productUrl = firstString(item.link, item.product_link, item.serpapi_product_api)
    const imageUrl = firstString(item.thumbnail, item.image, item.source_icon)
    if (!title || !productUrl || !imageUrl) return []

    const normalizedUrl = normalizeUrl(productUrl)
    const sourceId = firstString(item.product_id, item.product_id_v2) ?? stableHash(normalizedUrl)
    const priceText = firstString(item.price, item.extracted_price)

    return [{
      source: 'serpapi_google_shopping' as const,
      externalProductId: `serpapi:${sourceId}`,
      title,
      merchant: firstString(item.source, item.seller, item.merchant),
      productUrl: normalizedUrl,
      imageUrl,
      priceText,
      priceCents: typeof item.extracted_price === 'number'
        ? Math.round(item.extracted_price * 100)
        : parsePriceCents(priceText),
      currency: 'USD',
      rating: typeof item.rating === 'number' ? Math.round(item.rating * 10) : null,
      reviewCount: typeof item.reviews === 'number' ? item.reviews : null,
      rank: index + 1,
      rawJson: item,
    }]
  })

  return { results, raw }
}

export function dedupeProductResults(results: ProductSearchResultInput[]): ProductSearchResultInput[] {
  const seen = new Set<string>()
  const output: ProductSearchResultInput[] = []
  for (const result of results) {
    const key = [
      normalizeUrl(result.productUrl),
      result.title.toLowerCase().replace(/\s+/g, ' ').trim(),
      result.merchant?.toLowerCase() ?? '',
      result.imageUrl,
    ].join('|')
    if (seen.has(key)) continue
    seen.add(key)
    output.push(result)
  }
  return output
}

export function fallbackProductResults(query: string, limit: number): ProductSearchResultInput[] {
  return searchEmergencyCatalog(query, limit)
}

