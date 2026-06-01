import { describe, expect, it } from 'vitest'
import { curateAssortment } from '../assortment'
import { dedupeProductResults, fallbackProductResults } from '../product-search'
import { buildGenerationPrompt, buildSceneDescription } from '../prompts'
import { designPlanSchema, progressLabels } from '../types'
import type { DesignPlanOutput, ProductSearchResultInput } from '../types'

describe('shop lens product search helpers', () => {
  it('dedupes repeated product results by normalized commerce signals', () => {
    const results = dedupeProductResults([
      {
        source: 'serpapi_google_shopping',
        externalProductId: 'a',
        title: 'Outdoor String Lights',
        merchant: 'Target',
        productUrl: 'https://example.com/product?b=2&a=1#reviews',
        imageUrl: 'https://example.com/image.jpg',
        priceText: '$40',
        priceCents: 4000,
        currency: 'USD',
        rating: null,
        reviewCount: null,
        rank: 1,
        rawJson: {},
      },
      {
        source: 'serpapi_google_shopping',
        externalProductId: 'b',
        title: 'Outdoor   String Lights',
        merchant: 'Target',
        productUrl: 'https://example.com/product?a=1&b=2',
        imageUrl: 'https://example.com/image.jpg',
        priceText: '$40',
        priceCents: 4000,
        currency: 'USD',
        rating: null,
        reviewCount: null,
        rank: 2,
        rawJson: {},
      },
    ])

    expect(results).toHaveLength(1)
    expect(results[0].externalProductId).toBe('a')
  })

  it('returns emergency catalog results in the same normalized shape', () => {
    const results = fallbackProductResults('patio lighting', 2)

    expect(results).toHaveLength(2)
    expect(results[0].source).toBe('emergency_catalog')
    expect(results[0].title).toEqual(expect.any(String))
    expect(results[0].imageUrl).toMatch(/^https:\/\//)
  })
})

describe('shop lens planning contracts', () => {
  it('accepts a valid design plan payload', () => {
    const parsed = designPlanSchema.parse({
      userGoal: 'Make this patio feel cinematic',
      inferredScenario: 'event',
      budgetMode: 'none',
      targetBudgetCents: null,
      priceStrategy: 'best_result',
      desiredProductCount: 8,
      heroProductCount: 5,
      generationGoal: 'Create a shoppable patio scene',
      clarificationNeeded: false,
      clarificationQuestion: null,
      categories: [
        {
          name: 'lighting',
          priority: 1,
          desiredCount: 3,
          searchQueries: ['outdoor string lights'],
        },
      ],
    })

    expect(parsed.categories[0].name).toBe('lighting')
  })

  it('has human-readable labels for every surfaced run state', () => {
    expect(progressLabels.building_assortment).toContain('Curating')
    expect(progressLabels.generating_image).toContain('Composing')
    expect(progressLabels.presenting_result).toBe('Ready.')
  })
})

function product(overrides: Partial<ProductSearchResultInput> & {
  title: string
  query: string
  category: string
  rank: number
}): ProductSearchResultInput {
  return {
    source: 'serpapi_google_shopping',
    externalProductId: overrides.externalProductId ?? overrides.title,
    title: overrides.title,
    merchant: overrides.merchant ?? 'Merchant',
    productUrl: overrides.productUrl ?? `https://example.com/${encodeURIComponent(overrides.title)}`,
    imageUrl: overrides.imageUrl ?? 'https://example.com/image.jpg',
    priceText: overrides.priceText ?? '$10',
    priceCents: overrides.priceCents ?? 1000,
    currency: 'USD',
    rating: overrides.rating ?? null,
    reviewCount: overrides.reviewCount ?? null,
    rank: overrides.rank,
    rawJson: {
      planCategoryId: overrides.category,
      categoryName: overrides.category,
      query: overrides.query,
    },
  }
}

describe('shop lens assortment curation', () => {
  const plan: DesignPlanOutput = {
    userGoal: 'Decorate a space pirate Halloween party',
    inferredScenario: 'event',
    budgetMode: 'none',
    targetBudgetCents: null,
    priceStrategy: 'best_result',
    desiredProductCount: 6,
    heroProductCount: 2,
    generationGoal: 'Create a shoppable space pirate party',
    clarificationNeeded: false,
    clarificationQuestion: null,
    categories: [
      { name: 'wall decor', priority: 1, desiredCount: 2, searchQueries: ['galaxy tapestry', 'pirate flag'] },
      { name: 'tableware', priority: 2, desiredCount: 2, searchQueries: ['gold coins', 'skull goblets'] },
      { name: 'props', priority: 3, desiredCount: 2, searchQueries: ['inflatable alien', 'pirate swords'] },
    ],
  }

  it('keeps category and query variety instead of filling the list with near-duplicates', () => {
    const curated = curateAssortment([
      product({ title: 'Galaxy Tapestry Universe Space Tapestry', query: 'galaxy tapestry', category: 'wall', rank: 1 }),
      product({ title: 'Galaxy Tapestry', query: 'galaxy tapestry', category: 'wall', rank: 2 }),
      product({ title: 'Gold Pirate Treasure Coins', query: 'gold coins', category: 'tableware', rank: 1 }),
      product({ title: 'Gold Coin Favors 100ct', query: 'gold coins', category: 'tableware', rank: 2 }),
      product({ title: 'Summit Crowned Skull Wine Goblet', query: 'skull goblets', category: 'tableware', rank: 1 }),
      product({ title: 'ArtCreativity Green Inflatable Alien Decoration', query: 'inflatable alien', category: 'props', rank: 1 }),
      product({ title: 'Deluxe Pirate Sword', query: 'pirate swords', category: 'props', rank: 1 }),
    ], plan)

    expect(curated.map((item) => item.title)).toEqual([
      'Galaxy Tapestry Universe Space Tapestry',
      'Gold Pirate Treasure Coins',
      'Summit Crowned Skull Wine Goblet',
      'ArtCreativity Green Inflatable Alien Decoration',
      'Deluxe Pirate Sword',
      'Galaxy Tapestry',
    ])
    expect(curated.filter((item) => item.title.toLowerCase().includes('coin'))).toHaveLength(1)
    expect(curated.filter((item) => item.title.toLowerCase().includes('tapestry'))).toHaveLength(2)
  })
})

describe('shop lens generation prompt', () => {
  it('constrains prominent objects to linked product references', () => {
    const products = [
      { title: 'Galaxy Tapestry', merchant: 'Target', role: 'hero', quantity: 1 },
      { title: 'Skull Goblet', merchant: 'Party Store', role: 'supporting', quantity: 1 },
    ]
    const sceneDescription = buildSceneDescription({
      userPrompt: 'Space pirate party',
      generationGoal: 'Create a shoppable space pirate scene',
      products,
    })
    const prompt = buildGenerationPrompt({
      userPrompt: 'Space pirate party',
      generationGoal: 'Create a shoppable space pirate scene',
      sceneDescription,
      products,
      aspectRatio: '9:16',
    })

    expect(sceneDescription).toContain('Galaxy Tapestry')
    expect(prompt).toContain('Every visually prominent added object')
    expect(prompt).toContain('Do not invent major props')
  })
})
