import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { shopLensDb as db } from '@/db'
import { imageAssets } from '@/db/schema'
import { readShopLensObject } from '@/lib/shop-lens/storage'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: { assetId: string } }) {
  const [asset] = await db.select().from(imageAssets).where(eq(imageAssets.id, params.assetId)).limit(1)
  if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })

  if (asset.storageUrl.startsWith('http')) {
    return NextResponse.redirect(asset.storageUrl)
  }

  const metadata = asset.metadataJson as { r2Key?: string } | null
  if (metadata?.r2Key) {
    const bytes = await readShopLensObject(metadata.r2Key)
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'content-type': asset.mimeType,
        'cache-control': 'public, max-age=3600',
      },
    })
  }

  if (asset.originalUrl) return NextResponse.redirect(asset.originalUrl)
  return NextResponse.json({ error: 'Asset is not readable' }, { status: 404 })
}
