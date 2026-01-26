/**
 * Rate Limiter and Cost Ledger for Chatbot
 * Implements hard caps as per PRD:
 * - Daily LLM spend cap: $5/day
 * - Rolling 30-day cap: $100
 * - Per-IP rate limiting
 * - Circuit breaker for high traffic
 */

// In-memory storage (in production, use Redis or similar)
const ipRequestCounts: Map<string, { count: number; resetTime: number }> = new Map()
const sessionCounts: Map<string, { turns: number; tokens: number; startTime: number }> = new Map()
const costLedger: { timestamp: number; cost: number }[] = []

// Configuration
const CONFIG = {
  // Rate limits
  maxRequestsPerMinutePerIP: 10,
  maxRequestsPerHour: 100, // Circuit breaker threshold

  // Session limits (from PRD)
  maxTurnsPerConversation: 12,
  maxInputTokensPerConversation: 3000,
  maxOutputTokensPerConversation: 1500,
  maxConversationDurationMs: 8 * 60 * 1000, // 8 minutes

  // Cost limits (from PRD)
  dailyCostCapUSD: 5,
  monthlyCostCapUSD: 100,

  // Token pricing (Claude Sonnet - conservative estimate)
  inputTokenPricePerMillion: 3.00,
  outputTokenPricePerMillion: 15.00,
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

/**
 * Check if request is allowed based on IP rate limiting
 */
export function checkIPRateLimit(ip: string): RateLimitResult {
  const now = Date.now()
  const record = ipRequestCounts.get(ip)

  if (!record || now > record.resetTime) {
    ipRequestCounts.set(ip, { count: 1, resetTime: now + 60000 })
    return { allowed: true }
  }

  if (record.count >= CONFIG.maxRequestsPerMinutePerIP) {
    const retryAfter = Math.ceil((record.resetTime - now) / 1000)
    return {
      allowed: false,
      reason: 'Rate limit exceeded. Please wait before sending another message.',
      retryAfterSeconds: retryAfter,
    }
  }

  record.count++
  return { allowed: true }
}

/**
 * Check circuit breaker (global request volume)
 */
export function checkCircuitBreaker(): RateLimitResult {
  const now = Date.now()
  const oneHourAgo = now - 3600000

  // Count requests in last hour across all IPs
  let totalRequests = 0
  ipRequestCounts.forEach((record) => {
    if (record.resetTime > oneHourAgo) {
      totalRequests += record.count
    }
  })

  if (totalRequests >= CONFIG.maxRequestsPerHour) {
    return {
      allowed: false,
      reason: 'Service temporarily unavailable due to high demand. Please use the contact form below.',
      retryAfterSeconds: 300, // 5 minute cooldown
    }
  }

  return { allowed: true }
}

/**
 * Check session limits (turns, tokens, duration)
 */
export function checkSessionLimits(sessionId: string, inputTokens: number): RateLimitResult {
  const now = Date.now()
  let session = sessionCounts.get(sessionId)

  if (!session) {
    session = { turns: 0, tokens: 0, startTime: now }
    sessionCounts.set(sessionId, session)
  }

  // Check duration
  if (now - session.startTime > CONFIG.maxConversationDurationMs) {
    return {
      allowed: false,
      reason: 'Conversation time limit reached. Please start a new conversation or use the contact form.',
    }
  }

  // Check turns
  if (session.turns >= CONFIG.maxTurnsPerConversation) {
    return {
      allowed: false,
      reason: 'Maximum conversation length reached. Please use the contact form to send a message to Noah.',
    }
  }

  // Check input tokens
  if (session.tokens + inputTokens > CONFIG.maxInputTokensPerConversation) {
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
export function updateSession(sessionId: string, inputTokens: number, outputTokens: number): void {
  const session = sessionCounts.get(sessionId)
  if (session) {
    session.turns++
    session.tokens += inputTokens
  }

  // Record cost
  const cost = calculateCost(inputTokens, outputTokens)
  costLedger.push({ timestamp: Date.now(), cost })

  // Clean old entries (keep 30 days)
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
  while (costLedger.length > 0 && costLedger[0].timestamp < thirtyDaysAgo) {
    costLedger.shift()
  }
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
export function checkCostCaps(): RateLimitResult {
  const now = Date.now()
  const oneDayAgo = now - 24 * 60 * 60 * 1000
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000

  // Calculate daily cost
  const dailyCost = costLedger
    .filter(entry => entry.timestamp > oneDayAgo)
    .reduce((sum, entry) => sum + entry.cost, 0)

  if (dailyCost >= CONFIG.dailyCostCapUSD) {
    return {
      allowed: false,
      reason: 'Chat service is currently unavailable. Please use the contact form below.',
    }
  }

  // Calculate monthly cost
  const monthlyCost = costLedger
    .filter(entry => entry.timestamp > thirtyDaysAgo)
    .reduce((sum, entry) => sum + entry.cost, 0)

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
export function getUsageStats(): {
  dailyCost: number
  monthlyCost: number
  dailyCostLimit: number
  monthlyCostLimit: number
} {
  const now = Date.now()
  const oneDayAgo = now - 24 * 60 * 60 * 1000
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000

  return {
    dailyCost: costLedger
      .filter(entry => entry.timestamp > oneDayAgo)
      .reduce((sum, entry) => sum + entry.cost, 0),
    monthlyCost: costLedger
      .filter(entry => entry.timestamp > thirtyDaysAgo)
      .reduce((sum, entry) => sum + entry.cost, 0),
    dailyCostLimit: CONFIG.dailyCostCapUSD,
    monthlyCostLimit: CONFIG.monthlyCostCapUSD,
  }
}

/**
 * Generate a session ID
 */
export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Clean up old session data (call periodically)
 */
export function cleanupSessions(): void {
  const now = Date.now()
  const maxAge = CONFIG.maxConversationDurationMs * 2

  sessionCounts.forEach((session, id) => {
    if (now - session.startTime > maxAge) {
      sessionCounts.delete(id)
    }
  })

  ipRequestCounts.forEach((record, ip) => {
    if (now > record.resetTime + 3600000) {
      ipRequestCounts.delete(ip)
    }
  })
}
