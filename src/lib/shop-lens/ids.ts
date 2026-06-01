import { randomUUID, createHash } from 'crypto'

export function shopId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, '')}`
}

export function stableHash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 24)
}

export function normalizeUrl(value: string): string {
  try {
    const url = new URL(value)
    url.hash = ''
    url.searchParams.sort()
    return url.toString()
  } catch {
    return value.trim()
  }
}

