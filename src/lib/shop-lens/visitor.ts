import { createHmac, randomUUID, timingSafeEqual } from 'crypto'

const COOKIE_NAME = 'shop_lens_visitor'

function secret(): string {
  return process.env.SHOP_LENS_COOKIE_SECRET || process.env.NEXTAUTH_SECRET || 'shop-lens-dev-secret'
}

function sign(value: string): string {
  return createHmac('sha256', secret()).update(value).digest('hex').slice(0, 32)
}

export function createVisitorCookie(): { name: string; value: string } {
  const id = `v_${randomUUID().replace(/-/g, '')}`
  return { name: COOKIE_NAME, value: `${id}.${sign(id)}` }
}

export function readVisitorCookie(cookieValue?: string | null): string | null {
  if (!cookieValue) return null
  const [id, signature] = cookieValue.split('.')
  if (!id || !signature) return null
  const expected = sign(id)
  const expectedBuffer = Buffer.from(expected)
  const signatureBuffer = Buffer.from(signature)
  if (expectedBuffer.length !== signatureBuffer.length) return null
  return timingSafeEqual(expectedBuffer, signatureBuffer) ? id : null
}

export { COOKIE_NAME as SHOP_LENS_VISITOR_COOKIE }

