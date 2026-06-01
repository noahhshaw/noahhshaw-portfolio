import { redis, isRedisConfigured } from '@/lib/redis'
import { SHOP_LENS_DAILY_GENERATION_CAP } from './types'

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

export async function reserveDailyGenerationSlot(): Promise<{
  allowed: boolean
  count: number
  limit: number
}> {
  if (!isRedisConfigured()) {
    return { allowed: true, count: 0, limit: SHOP_LENS_DAILY_GENERATION_CAP }
  }

  const key = `shop_lens:generation_count:${todayKey()}`
  const count = await redis.incr(key)
  if (count === 1) {
    await redis.expire(key, 60 * 60 * 48)
  }

  return {
    allowed: count <= SHOP_LENS_DAILY_GENERATION_CAP,
    count,
    limit: SHOP_LENS_DAILY_GENERATION_CAP,
  }
}

