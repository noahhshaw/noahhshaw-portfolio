/**
 * Upstash Redis Client
 *
 * Used for persistent storage of:
 * - Rate limiting data
 * - Cost tracking/ledger
 * - Conversation logs
 * - Session data
 *
 * Setup:
 * 1. Create a free database at https://console.upstash.com
 * 2. Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to env vars
 */

import { Redis } from '@upstash/redis'

// Create Redis client (will throw if env vars not set)
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
})

// Key prefixes for organization
export const REDIS_KEYS = {
  // Rate limiting
  IP_RATE: (ip: string) => `rate:ip:${ip}`,
  SESSION: (id: string) => `session:${id}`,
  CIRCUIT_BREAKER: 'circuit:requests',

  // Cost tracking
  COST_DAILY: (date: string) => `cost:daily:${date}`,
  COST_MONTHLY: (month: string) => `cost:monthly:${month}`,

  // Conversation logs
  CONVERSATION: (id: string) => `conv:${id}`,
  CONVERSATION_INDEX: 'conv:index',

  // Contact tracking
  CONTACT_ATTEMPT: (id: string) => `contact:attempt:${id}`,
  CONTACT_PENDING: 'contact:pending',
}

/**
 * Check if Redis is configured
 */
export function isRedisConfigured(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
}

/**
 * Get today's date key (YYYY-MM-DD)
 */
export function getTodayKey(): string {
  return new Date().toISOString().split('T')[0]
}

/**
 * Get current month key (YYYY-MM)
 */
export function getMonthKey(): string {
  return new Date().toISOString().slice(0, 7)
}
