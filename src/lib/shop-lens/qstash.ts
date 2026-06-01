import { Client } from '@upstash/qstash'

let client: Client | null = null

function getQstashClient(): Client | null {
  if (!process.env.QSTASH_TOKEN) return null
  if (!client) client = new Client({ token: process.env.QSTASH_TOKEN })
  return client
}

export function getAppBaseUrl(): string | null {
  if (process.env.SHOP_LENS_APP_URL) return process.env.SHOP_LENS_APP_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return null
}

export async function enqueueShopLensRun(runId: string): Promise<string | null> {
  const qstash = getQstashClient()
  const baseUrl = getAppBaseUrl()
  if (!qstash || !baseUrl) return null

  const response = await qstash.publishJSON({
    url: `${baseUrl}/api/shop-lens/worker`,
    body: { runId },
    deduplicationId: `shop-lens-${runId}`,
    retries: 2,
    timeout: '300s',
  })

  return response.messageId
}

