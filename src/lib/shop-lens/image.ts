import sharp from 'sharp'
import { shopId } from './ids'
import { SHOP_LENS_MAX_UPLOAD_BYTES } from './types'

export const acceptedImageTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
])

export function assertAcceptedImage(file: File): void {
  if (!acceptedImageTypes.has(file.type)) {
    throw new Error(`Unsupported image type: ${file.type || 'unknown'}`)
  }
  if (file.size > SHOP_LENS_MAX_UPLOAD_BYTES) {
    throw new Error('Image is too large')
  }
}

export async function normalizeImageBytes(input: Buffer): Promise<{
  bytes: Buffer
  contentType: string
  width: number | null
  height: number | null
  aspectRatio: string | null
  exifOrientationApplied: boolean
}> {
  const image = sharp(input, { failOn: 'none' }).rotate()
  const metadata = await image.metadata()
  const output = await image
    .resize({
      width: 1536,
      height: 1536,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 88 })
    .toBuffer()
  const outputMeta = await sharp(output).metadata()
  const width = outputMeta.width ?? null
  const height = outputMeta.height ?? null

  return {
    bytes: output,
    contentType: 'image/jpeg',
    width,
    height,
    aspectRatio: width && height ? `${width}:${height}` : null,
    exifOrientationApplied: !!metadata.orientation,
  }
}

export async function fetchAndNormalizeImage(url: string): Promise<{
  bytes: Buffer
  contentType: string
  width: number | null
  height: number | null
  aspectRatio: string | null
}> {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 Shop Lens Demo Image Fetcher',
      accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    },
  })
  if (!response.ok) {
    throw new Error(`Image fetch failed with ${response.status}`)
  }
  const buffer = Buffer.from(await response.arrayBuffer())
  const normalized = await normalizeImageBytes(buffer)
  return normalized
}

export function makeShopLensObjectKey(kind: string, extension = 'jpg'): string {
  return `shop-lens/${kind}/${new Date().toISOString().slice(0, 10)}/${shopId('img')}.${extension}`
}

