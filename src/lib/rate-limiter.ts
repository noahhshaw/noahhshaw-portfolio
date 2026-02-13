/**
 * Rate Limiter and Cost Ledger for Chatbot
 * Uses Upstash Redis for persistent storage
 *
 * Implements hard caps as per PRD:
 * - Daily LLM spend cap: $5/day
 * - Rolling 30-day cap: $100
 * - Per-IP rate limiting
 * - Circuit breaker for high traffic
 */

import { redis, REDIS_KEYS, isRedisConfigured, getTodayKey, getMonthKey } from './redis'
import { randomUUID } from 'crypto'

// Configuration
const CONFIG = {
  // Rate limits
  maxRequestsPerMinutePerIP: 10,
  maxRequestsPerHour: 100, // Circuit breaker threshold

  // Session limits (from PRD)
  maxTurnsPerConversation: 12,
  maxInputTokensPerConversation: 20000,
  maxOutputTokensPerConversation: 6000,
  maxConversationDurationMs: 8 * 60 * 1000, // 8 minutes

  // Cost limits (from PRD)
  dailyCostCapUSD: 5,
  monthlyCostCapUSD: 100,

  // Token pricing (Claude Haiku 4.5)
  inputTokenPricePerMillion: 0.80,
  outputTokenPricePerMillion: 4.00,
}

interface RateLimitResult {
  allowed: boolean
  reason?: string
  retryAfterSeconds?: number
}

interface SessionState {
  turns: number
  inputTokens: number
  outputTokens: number
  startTime: number
}

// In-memory fallback for when Redis is not configured
const memoryFallback = {
  ipCounts: new Map<string, { count: number; resetTime: number }>(),
  sessions: new Map<string, SessionState>(),
  dailyCost: 0,
  monthlyCost: 0,
  lastReset: getTodayKey(),
}

/**
 * Check if request is allowed based on IP rate limiting
 */
export async function checkIPRateLimit(ip: string): Promise<RateLimitResult> {
  const now = Date.now()

  if (!isRedisConfigured()) {
    // Fallback to in-memory
    const record = memoryFallback.ipCounts.get(ip)
    if (!record || now > record.resetTime) {
      memoryFallback.ipCounts.set(ip, { count: 1, resetTime: now + 60000 })
      return { allowed: true }
    }
    if (record.count >= CONFIG.maxRequestsPerMinutePerIP) {
      return {
        allowed: false,
        reason: 'Rate limit exceeded. Please wait before sending another message.',
        retryAfterSeconds: Math.ceil((record.resetTime - now) / 1000),
      }
    }
    record.count++
    return { allowed: true }
  }

  // Use Redis
  const key = REDIS_KEYS.IP_RATE(ip)
  const count = await redis.incr(key)

  if (count === 1) {
    // First request, set expiry
    await redis.expire(key, 60)
  }

  if (count > CONFIG.maxRequestsPerMinutePerIP) {
    const ttl = await redis.ttl(key)
    return {
      allowed: false,
      reason: 'Rate limit exceeded. Please wait before sending another message.',
      retryAfterSeconds: ttl > 0 ? ttl : 60,
    }
  }

  return { allowed: true }
}

/**
 * Check circuit breaker (global request volume)
 */
export async function checkCircuitBreaker(): Promise<RateLimitResult> {
  if (!isRedisConfigured()) {
    // Skip circuit breaker in memory mode
    return { allowed: true }
  }

  const key = REDIS_KEYS.CIRCUIT_BREAKER
  const count = await redis.incr(key)

  if (count === 1) {
    // Set 1-hour expiry
    await redis.expire(key, 3600)
  }

  if (count > CONFIG.maxRequestsPerHour) {
    return {
      allowed: false,
      reason: 'Service temporarily unavailable due to high demand. Please use the contact form below.',
      retryAfterSeconds: 300,
    }
  }

  return { allowed: true }
}

/**
 * Check session limits (turns, tokens, duration)
 */
export async function checkSessionLimits(sessionId: string, inputTokens: number): Promise<RateLimitResult> {
  const now = Date.now()

  if (!isRedisConfigured()) {
    // Fallback to in-memory
    let session = memoryFallback.sessions.get(sessionId)
    if (!session) {
      session = { turns: 0, inputTokens: 0, outputTokens: 0, startTime: now }
      memoryFallback.sessions.set(sessionId, session)
    }

    if (now - session.startTime > CONFIG.maxConversationDurationMs) {
      return {
        allowed: false,
        reason: 'Conversation time limit reached. Please start a new conversation or use the contact form.',
      }
    }

    if (session.turns >= CONFIG.maxTurnsPerConversation) {
      return {
        allowed: false,
        reason: 'Maximum conversation length reached. Please use the contact form to send a message to Noah.',
      }
    }

    if (session.inputTokens + inputTokens > CONFIG.maxInputTokensPerConversation) {
      return {
        allowed: false,
        reason: 'Message too long. Please keep your message concise or use the contact form.',
      }
    }

    return { allowed: true }
  }

  // Use Redis
  const key = REDIS_KEYS.SESSION(sessionId)
  const sessionData = await redis.hgetall(key) as Record<string, string> | null

  if (!sessionData || Object.keys(sessionData).length === 0) {
    // New session
    await redis.hset(key, {
      turns: 0,
      inputTokens: 0,
      outputTokens: 0,
      startTime: now,
    })
    await redis.expire(key, Math.ceil(CONFIG.maxConversationDurationMs / 1000) * 2)
    return { allowed: true }
  }

  const session: SessionState = {
    turns: parseInt(sessionData.turns || '0'),
    inputTokens: parseInt(sessionData.inputTokens || '0'),
    outputTokens: parseInt(sessionData.outputTokens || '0'),
    startTime: parseInt(sessionData.startTime || String(now)),
  }

  if (now - session.startTime > CONFIG.maxConversationDurationMs) {
    return {
      allowed: false,
      reason: 'Conversation time limit reached. Please start a new conversation or use the contact form.',
    }
  }

  if (session.turns >= CONFIG.maxTurnsPerConversation) {
    return {
      allowed: false,
      reason: 'Maximum conversation length reached. Please use the contact form to send a message to Noah.',
    }
  }

  if (session.inputTokens + inputTokens > CONFIG.maxInputTokensPerConversation) {
    return {
      allowed: false,
      reason: 'Message too long. Please keep your message concise or use the contact form.',
    }
  }

  return { allowed: true }
}

/**
 * Update session after successful response
 */
export async function updateSession(sessionId: string, inputTokens: number, outputTokens: number): Promise<void> {
  const cost = calculateCost(inputTokens, outputTokens)

  if (!isRedisConfigured()) {
    // Fallback to in-memory
    const session = memoryFallback.sessions.get(sessionId)
    if (session) {
      session.turns++
      session.inputTokens += inputTokens
      session.outputTokens += outputTokens
    }

    // Reset daily cost if new day
    const today = getTodayKey()
    if (memoryFallback.lastReset !== today) {
      memoryFallback.dailyCost = 0
      memoryFallback.lastReset = today
    }
    memoryFallback.dailyCost += cost
    memoryFallback.monthlyCost += cost
    return
  }

  // Update session in Redis
  const sessionKey = REDIS_KEYS.SESSION(sessionId)
  await redis.hincrby(sessionKey, 'turns', 1)
  await redis.hincrby(sessionKey, 'inputTokens', inputTokens)
  await redis.hincrby(sessionKey, 'outputTokens', outputTokens)

  // Update cost tracking
  const today = getTodayKey()
  const month = getMonthKey()
  const dailyKey = REDIS_KEYS.COST_DAILY(today)
  const monthlyKey = REDIS_KEYS.COST_MONTHLY(month)

  // Use INCRBYFLOAT for cost tracking (multiply by 1000000 to avoid float precision issues)
  const costMicros = Math.round(cost * 1000000)
  await redis.incrby(dailyKey, costMicros)
  await redis.incrby(monthlyKey, costMicros)

  // Set expiry on daily key (2 days to be safe)
  await redis.expire(dailyKey, 86400 * 2)
  // Set expiry on monthly key (35 days)
  await redis.expire(monthlyKey, 86400 * 35)
}

/**
 * Calculate cost for tokens
 */
function calculateCost(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1000000) * CONFIG.inputTokenPricePerMillion
  const outputCost = (outputTokens / 1000000) * CONFIG.outputTokenPricePerMillion
  return inputCost + outputCost
}

/**
 * Check if within cost caps
 */
export async function checkCostCaps(): Promise<RateLimitResult> {
  if (!isRedisConfigured()) {
    // Fallback to in-memory
    if (memoryFallback.dailyCost >= CONFIG.dailyCostCapUSD) {
      return {
        allowed: false,
        reason: 'Chat service is currently unavailable. Please use the contact form below.',
      }
    }
    if (memoryFallback.monthlyCost >= CONFIG.monthlyCostCapUSD) {
      return {
        allowed: false,
        reason: 'Chat service is currently unavailable. Please use the contact form below.',
      }
    }
    return { allowed: true }
  }

  // Check Redis
  const today = getTodayKey()
  const month = getMonthKey()

  const [dailyCostMicros, monthlyCostMicros] = await Promise.all([
    redis.get(REDIS_KEYS.COST_DAILY(today)),
    redis.get(REDIS_KEYS.COST_MONTHLY(month)),
  ])

  const dailyCost = (Number(dailyCostMicros) || 0) / 1000000
  const monthlyCost = (Number(monthlyCostMicros) || 0) / 1000000

  if (dailyCost >= CONFIG.dailyCostCapUSD) {
    return {
      allowed: false,
      reason: 'Chat service is currently unavailable. Please use the contact form below.',
    }
  }

  if (monthlyCost >= CONFIG.monthlyCostCapUSD) {
    return {
      allowed: false,
      reason: 'Chat service is currently unavailable. Please use the contact form below.',
    }
  }

  return { allowed: true }
}

/**
 * Get current usage stats (for monitoring)
 */
export async function getUsageStats(): Promise<{
  dailyCost: number
  monthlyCost: number
  dailyCostLimit: number
  monthlyCostLimit: number
}> {
  if (!isRedisConfigured()) {
    return {
      dailyCost: memoryFallback.dailyCost,
      monthlyCost: memoryFallback.monthlyCost,
      dailyCostLimit: CONFIG.dailyCostCapUSD,
      monthlyCostLimit: CONFIG.monthlyCostCapUSD,
    }
  }

  const today = getTodayKey()
  const month = getMonthKey()

  const [dailyCostMicros, monthlyCostMicros] = await Promise.all([
    redis.get(REDIS_KEYS.COST_DAILY(today)),
    redis.get(REDIS_KEYS.COST_MONTHLY(month)),
  ])

  return {
    dailyCost: (Number(dailyCostMicros) || 0) / 1000000,
    monthlyCost: (Number(monthlyCostMicros) || 0) / 1000000,
    dailyCostLimit: CONFIG.dailyCostCapUSD,
    monthlyCostLimit: CONFIG.monthlyCostCapUSD,
  }
}

/**
 * Generate a session ID
 */
export function generateSessionId(): string {
  return `session_${Date.now()}_${randomUUID()}`
}
