import { NextResponse } from 'next/server'
import { markStaleShopLensRunsFailed } from '@/lib/shop-lens/agent'

export const dynamic = 'force-dynamic'

export async function GET() {
  await markStaleShopLensRunsFailed()
  return NextResponse.json({ ok: true })
}
