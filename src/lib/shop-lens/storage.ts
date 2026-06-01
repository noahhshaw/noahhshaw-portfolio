import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { S3Client } from '@aws-sdk/client-s3'
import { mkdir, readFile, writeFile } from 'fs/promises'
import path from 'path'

let client: S3Client | null = null

function getR2Env() {
  return {
    accountId: process.env.SHOP_LENS_R2_ACCOUNT_ID || process.env.R2_ACCOUNT_ID,
    accessKeyId: process.env.SHOP_LENS_R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.SHOP_LENS_R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY,
    bucket: process.env.SHOP_LENS_R2_BUCKET || process.env.R2_BUCKET,
    publicBaseUrl: process.env.SHOP_LENS_R2_PUBLIC_BASE_URL || process.env.R2_PUBLIC_BASE_URL,
  }
}

function isR2Ready(): boolean {
  const env = getR2Env()
  return !!(
    env.accountId &&
    env.accessKeyId &&
    env.secretAccessKey &&
    env.bucket
  )
}

function getClient(): S3Client {
  if (client) return client
  const { accountId, accessKeyId, secretAccessKey } = getR2Env()
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 credentials are not configured')
  }
  client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  })
  return client
}

function getLocalObjectPath(key: string): string {
  const safeKey = key.replace(/^\/+/, '').replace(/\.\./g, '_')
  return path.join(process.cwd(), '.shop-lens-cache', safeKey)
}

export async function storeShopLensObject(opts: {
  key: string
  bytes: Uint8Array | Buffer
  contentType: string
  fallbackUrl?: string
}): Promise<{ storageUrl: string; key: string; cached: boolean }> {
  if (!isR2Ready()) {
    const localPath = getLocalObjectPath(opts.key)
    await mkdir(path.dirname(localPath), { recursive: true })
    await writeFile(localPath, opts.bytes)
    return {
      storageUrl: `shop-lens-local://${opts.key}`,
      key: opts.key,
      cached: true,
    }
  }

  await getClient().send(
    new PutObjectCommand({
      Bucket: getR2Env().bucket!,
      Key: opts.key,
      Body: opts.bytes,
      ContentType: opts.contentType,
    })
  )

  const publicBase = getR2Env().publicBaseUrl
  return {
    storageUrl: publicBase ? `${publicBase}/${opts.key}` : `r2://${opts.key}`,
    key: opts.key,
    cached: true,
  }
}

async function streamToBuffer(stream: unknown): Promise<Buffer> {
  if (!stream || typeof (stream as { transformToByteArray?: unknown }).transformToByteArray !== 'function') {
    throw new Error('Unsupported R2 response stream')
  }
  const bytes = await (stream as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray()
  return Buffer.from(bytes)
}

export async function readShopLensObject(key: string): Promise<Buffer> {
  if (!isR2Ready()) {
    return readFile(getLocalObjectPath(key))
  }

  const response = await getClient().send(
    new GetObjectCommand({
      Bucket: getR2Env().bucket!,
      Key: key,
    })
  )
  return streamToBuffer(response.Body)
}
