import type { ProductSearchResultInput } from './types'

const fallbackItems = [
  {
    title: 'Warm White Outdoor String Lights',
    merchant: 'Target',
    productUrl: 'https://www.target.com/s?searchTerm=outdoor+string+lights',
    imageUrl: 'https://target.scene7.com/is/image/Target/GUEST_79f80fb6-e044-47a9-b969-a676bce8c7ca',
    priceCents: 3500,
    category: 'lighting',
  },
  {
    title: 'Folding Patio Dining Table',
    merchant: 'IKEA',
    productUrl: 'https://www.ikea.com/us/en/search/?q=outdoor%20table',
    imageUrl: 'https://www.ikea.com/us/en/images/products/taernoe-table-outdoor-black-light-brown-stained__0737093_pe740875_s5.jpg',
    priceCents: 5999,
    category: 'table',
  },
  {
    title: 'Green Accent Throw Pillow',
    merchant: 'Wayfair',
    productUrl: 'https://www.wayfair.com/keyword.php?keyword=green+throw+pillow',
    imageUrl: 'https://assets.wfcdn.com/im/45923635/resize-h800-w800%5Ecompr-r85/2411/241157628/default_name.jpg',
    priceCents: 2400,
    category: 'decor',
  },
  {
    title: 'Blue Gingham Tablecloth',
    merchant: 'Amazon',
    productUrl: 'https://www.amazon.com/s?k=blue+gingham+tablecloth',
    imageUrl: 'https://m.media-amazon.com/images/I/71YpGz42QgL._AC_SL1500_.jpg',
    priceCents: 1899,
    category: 'tableware',
  },
]

export function searchEmergencyCatalog(query: string, limit: number): ProductSearchResultInput[] {
  const lower = query.toLowerCase()
  const ranked = fallbackItems
    .map((item, index) => ({
      item,
      score: lower.includes(item.category) || lower.includes(item.title.toLowerCase().split(' ')[0]) ? 2 : 1,
      index,
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)

  return ranked.map(({ item }, index) => ({
    source: 'emergency_catalog',
    externalProductId: `emergency:${item.category}:${index}`,
    title: item.title,
    merchant: item.merchant,
    productUrl: item.productUrl,
    imageUrl: item.imageUrl,
    priceText: `$${(item.priceCents / 100).toFixed(2)}`,
    priceCents: item.priceCents,
    currency: 'USD',
    rating: null,
    reviewCount: null,
    rank: index + 1,
    rawJson: item,
  }))
}

