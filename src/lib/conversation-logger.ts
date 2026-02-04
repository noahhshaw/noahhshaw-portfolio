/**
 * Conversation Logger
 * Logs all chatbot conversations to Redis for retention (up to 5 years per PRD)
 *
 * Features:
 * - Logs each message with timestamp
 * - Anonymizes IP (hashes it)
 * - Stores conversation metadata
 * - Supports retrieval for monitoring
 */

import { redis, REDIS_KEYS, isRedisConfigured } from './redis'
import { createHash, randomUUID } from 'crypto'

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  intent?: string
  tokensUsed?: {
    input: number
    output: number
  }
}

export interface ConversationLog {
  id: string
  sessionId: string
  anonymizedIp: string
  startTime: number
  lastActivity: number
  messages: ConversationMessage[]
  contactAttempt?: {
    started: boolean
    completed: boolean
    name?: string
    email?: string
    company?: string
  }
}

// 5 years in seconds (PRD requirement)
const RETENTION_SECONDS = 5 * 365 * 24 * 60 * 60

// Generate a secure random salt if not provided via env var
// WARNING: This will change on each restart if IP_SALT is not set!
const IP_SALT = process.env.IP_SALT || (() => {
  const salt = randomUUID()
  console.warn('[Logger] IP_SALT not set in environment, using runtime-generated salt. Set IP_SALT for consistent anonymization across restarts.')
  return salt
})()

/**
 * Anonymize IP address by hashing
 */
function anonymizeIp(ip: string): string {
  return createHash('sha256').update(ip + IP_SALT).digest('hex').substring(0, 16)
}

/**
 * Generate a conversation ID
 */
export function generateConversationId(): string {
  return `conv_${Date.now()}_${randomUUID()}`
}

/**
 * Start a new conversation log
 */
export async function startConversation(
  conversationId: string,
  sessionId: string,
  ip: string
): Promise<void> {
  if (!isRedisConfigured()) {
    console.log('[Logger] Redis not configured, skipping conversation log')
    return
  }

  const log: ConversationLog = {
    id: conversationId,
    sessionId,
    anonymizedIp: anonymizeIp(ip),
    startTime: Date.now(),
    lastActivity: Date.now(),
    messages: [],
  }

  const key = REDIS_KEYS.CONVERSATION(conversationId)
  await redis.set(key, JSON.stringify(log), { ex: RETENTION_SECONDS })

  // Add to index for retrieval
  await redis.zadd(REDIS_KEYS.CONVERSATION_INDEX, {
    score: Date.now(),
    member: conversationId,
  })
}

/**
 * Safely parse conversation data from Redis
 * Upstash Redis auto-deserializes JSON, so we may receive an object or string
 */
function parseConversationData(data: unknown): ConversationLog | null {
  if (!data) return null
  if (typeof data === 'object') return data as ConversationLog
  if (typeof data === 'string') {
    try {
      return JSON.parse(data)
    } catch (error) {
      console.error('[Logger] Failed to parse conversation data:', error)
      return null
    }
  }
  return null
}

/**
 * Log a message to an existing conversation
 */
export async function logMessage(
  conversationId: string,
  message: ConversationMessage
): Promise<void> {
  if (!isRedisConfigured()) {
    return
  }

  const key = REDIS_KEYS.CONVERSATION(conversationId)
  const existing = await redis.get(key)

  if (!existing) {
    console.warn(`[Logger] Conversation ${conversationId} not found`)
    return
  }

  const log = parseConversationData(existing)
  if (!log) {
    console.warn(`[Logger] Failed to parse conversation ${conversationId}`)
    return
  }
  log.messages.push(message)
  log.lastActivity = Date.now()

  await redis.set(key, JSON.stringify(log), { ex: RETENTION_SECONDS })
}

/**
 * Mark a contact attempt as started
 */
export async function markContactAttemptStarted(
  conversationId: string,
  name?: string,
  email?: string,
  company?: string
): Promise<void> {
  if (!isRedisConfigured()) {
    return
  }

  const key = REDIS_KEYS.CONVERSATION(conversationId)
  const existing = await redis.get(key)

  const log = parseConversationData(existing)
  if (!log) {
    return
  }

  log.contactAttempt = {
    started: true,
    completed: false,
    name,
    email,
    company,
  }
  log.lastActivity = Date.now()

  await redis.set(key, JSON.stringify(log), { ex: RETENTION_SECONDS })

  // Add to pending contacts for abandonment tracking
  await redis.sadd(REDIS_KEYS.CONTACT_PENDING, conversationId)
}

/**
 * Mark a contact attempt as completed (message sent)
 */
export async function markContactAttemptCompleted(conversationId: string): Promise<void> {
  if (!isRedisConfigured()) {
    return
  }

  const key = REDIS_KEYS.CONVERSATION(conversationId)
  const existing = await redis.get(key)

  const log = parseConversationData(existing)
  if (!log) {
    return
  }

  if (log.contactAttempt) {
    log.contactAttempt.completed = true
  }
  log.lastActivity = Date.now()

  await redis.set(key, JSON.stringify(log), { ex: RETENTION_SECONDS })

  // Remove from pending contacts
  await redis.srem(REDIS_KEYS.CONTACT_PENDING, conversationId)
}

/**
 * Get pending (abandoned) contact attempts
 */
export async function getPendingContactAttempts(): Promise<ConversationLog[]> {
  if (!isRedisConfigured()) {
    return []
  }

  const pendingIds = await redis.smembers(REDIS_KEYS.CONTACT_PENDING)
  const results: ConversationLog[] = []

  for (const id of pendingIds) {
    const key = REDIS_KEYS.CONVERSATION(id)
    const data = await redis.get(key)
    const log = parseConversationData(data)
    if (log) {
      // Check if it's been more than 10 minutes since last activity (likely abandoned)
      if (Date.now() - log.lastActivity > 10 * 60 * 1000) {
        results.push(log)
      }
    }
  }

  return results
}

/**
 * Get a conversation by ID
 */
export async function getConversation(conversationId: string): Promise<ConversationLog | null> {
  if (!isRedisConfigured()) {
    return null
  }

  const key = REDIS_KEYS.CONVERSATION(conversationId)
  const data = await redis.get(key)

  return parseConversationData(data)
}

/**
 * Get recent conversations (for monitoring)
 */
export async function getRecentConversations(limit: number = 50): Promise<ConversationLog[]> {
  if (!isRedisConfigured()) {
    return []
  }

  // Get most recent conversation IDs from index
  const ids = await redis.zrange(REDIS_KEYS.CONVERSATION_INDEX, -limit, -1)
  const results: ConversationLog[] = []

  for (const id of ids) {
    const log = await getConversation(id as string)
    if (log) {
      results.push(log)
    }
  }

  return results.reverse() // Most recent first
}

/**
 * Get conversation statistics
 */
export async function getConversationStats(): Promise<{
  totalConversations: number
  conversationsToday: number
  pendingContacts: number
}> {
  if (!isRedisConfigured()) {
    return {
      totalConversations: 0,
      conversationsToday: 0,
      pendingContacts: 0,
    }
  }

  const total = await redis.zcard(REDIS_KEYS.CONVERSATION_INDEX)
  const pendingCount = await redis.scard(REDIS_KEYS.CONTACT_PENDING)

  // Count conversations from today
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayCount = await redis.zcount(
    REDIS_KEYS.CONVERSATION_INDEX,
    todayStart.getTime(),
    Date.now()
  )

  return {
    totalConversations: total,
    conversationsToday: todayCount,
    pendingContacts: pendingCount,
  }
}
