import { NextRequest, NextResponse } from 'next/server'
import { getUsageStats } from '@/lib/rate-limiter'
import { getConversationStats } from '@/lib/conversation-logger'
import { isRedisConfigured } from '@/lib/redis'

/**
 * Chatbot Statistics API
 *
 * Access this endpoint to monitor chatbot health and usage.
 * Protected by simple bearer token (set ADMIN_TOKEN env var)
 *
 * Usage:
 * GET /api/chatbot-stats?token=your_secret_token
 */
export async function GET(request: NextRequest) {
  // Simple authentication (optional - set ADMIN_TOKEN in env)
  const adminToken = process.env.ADMIN_TOKEN
  const providedToken = request.nextUrl.searchParams.get('token')

  if (adminToken && providedToken !== adminToken) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    // Get cost and conversation stats
    const [costStats, conversationStats] = await Promise.all([
      getUsageStats(),
      getConversationStats(),
    ])

    // Check service configuration
    const config = {
      anthropicConfigured: !!process.env.ANTHROPIC_API_KEY,
      resendConfigured: !!process.env.RESEND_API_KEY,
      redisConfigured: isRedisConfigured(),
    }

    // Calculate percentages for cost caps
    const dailyUsagePercent = (costStats.dailyCost / costStats.dailyCostLimit) * 100
    const monthlyUsagePercent = (costStats.monthlyCost / costStats.monthlyCostLimit) * 100

    // Determine service status
    let status: 'healthy' | 'warning' | 'critical' | 'offline'
    let statusMessage: string

    if (!config.anthropicConfigured) {
      status = 'offline'
      statusMessage = 'Anthropic API not configured'
    } else if (dailyUsagePercent >= 100 || monthlyUsagePercent >= 100) {
      status = 'offline'
      statusMessage = 'Cost cap exceeded'
    } else if (dailyUsagePercent >= 80 || monthlyUsagePercent >= 80) {
      status = 'warning'
      statusMessage = 'Approaching cost limit'
    } else {
      status = 'healthy'
      statusMessage = 'All systems operational'
    }

    return NextResponse.json({
      status,
      statusMessage,
      timestamp: new Date().toISOString(),

      // Service configuration
      services: {
        chatbot: config.anthropicConfigured ? 'configured' : 'not configured',
        notifications: config.resendConfigured ? 'configured' : 'not configured',
        persistence: config.redisConfigured ? 'redis' : 'in-memory',
      },

      // Cost tracking
      costs: {
        daily: {
          spent: costStats.dailyCost.toFixed(4),
          limit: costStats.dailyCostLimit,
          percentUsed: dailyUsagePercent.toFixed(1),
          status: dailyUsagePercent >= 100 ? 'exceeded' : dailyUsagePercent >= 80 ? 'warning' : 'ok',
        },
        monthly: {
          spent: costStats.monthlyCost.toFixed(4),
          limit: costStats.monthlyCostLimit,
          percentUsed: monthlyUsagePercent.toFixed(1),
          status: monthlyUsagePercent >= 100 ? 'exceeded' : monthlyUsagePercent >= 80 ? 'warning' : 'ok',
        },
      },

      // Conversation stats
      conversations: {
        total: conversationStats.totalConversations,
        today: conversationStats.conversationsToday,
        pendingContacts: conversationStats.pendingContacts,
      },

      // Warnings
      warnings: [
        !config.redisConfigured && 'Redis not configured - using in-memory storage (resets on deploy)',
        !config.resendConfigured && 'Resend not configured - notifications disabled',
        dailyUsagePercent >= 80 && `Daily cost at ${dailyUsagePercent.toFixed(1)}%`,
        monthlyUsagePercent >= 80 && `Monthly cost at ${monthlyUsagePercent.toFixed(1)}%`,
      ].filter(Boolean),

      // Next actions
      recommendations: [
        !config.redisConfigured && 'Configure Upstash Redis for persistent storage',
        !config.resendConfigured && 'Configure Resend for email notifications',
        conversationStats.pendingContacts > 5 && 'High number of pending contacts - check for UX issues',
        dailyUsagePercent >= 50 && 'Monitor daily costs closely',
      ].filter(Boolean),
    })
  } catch (error) {
    console.error('Stats API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stats', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
