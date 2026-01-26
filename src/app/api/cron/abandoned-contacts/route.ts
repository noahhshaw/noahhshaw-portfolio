import { NextRequest, NextResponse } from 'next/server'
import { getPendingContactAttempts } from '@/lib/conversation-logger'
import { notifyAbandonedContact } from '@/lib/notifications'

/**
 * Cron Job: Check for Abandoned Contacts
 *
 * This endpoint should be triggered daily via Vercel Cron or external service.
 *
 * Setup with Vercel Cron:
 * 1. Create vercel.json in root:
 *    {
 *      "crons": [{
 *        "path": "/api/cron/abandoned-contacts",
 *        "schedule": "0 9 * * *"
 *      }]
 *    }
 *
 * 2. Set CRON_SECRET in environment variables
 *
 * Or use external service:
 * - Set up daily GET request to this endpoint
 * - Include ?token=CRON_SECRET in query params
 */
export async function GET(request: NextRequest) {
  // Verify cron authorization
  const authHeader = request.headers.get('authorization')
  const tokenParam = request.nextUrl.searchParams.get('token')
  const cronSecret = process.env.CRON_SECRET

  // Allow either Bearer token or query param
  const providedToken = authHeader?.replace('Bearer ', '') || tokenParam

  if (cronSecret && providedToken !== cronSecret) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    // Get all pending contact attempts (abandoned for 10+ minutes)
    const pendingContacts = await getPendingContactAttempts()

    if (pendingContacts.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No abandoned contacts found',
        count: 0,
      })
    }

    // Send notification for each abandoned contact
    const results = await Promise.allSettled(
      pendingContacts.map(async (contact) => {
        if (contact.contactAttempt) {
          await notifyAbandonedContact({
            name: contact.contactAttempt.name || 'Unknown',
            email: contact.contactAttempt.email || 'Not provided',
            company: contact.contactAttempt.company,
            conversationId: contact.id,
          })
        }
      })
    )

    const successful = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length

    return NextResponse.json({
      success: true,
      message: `Processed ${pendingContacts.length} abandoned contacts`,
      count: pendingContacts.length,
      notifications: {
        sent: successful,
        failed,
      },
      abandonedContacts: pendingContacts.map(c => ({
        conversationId: c.id,
        name: c.contactAttempt?.name,
        email: c.contactAttempt?.email,
        lastActivity: new Date(c.lastActivity).toISOString(),
      })),
    })
  } catch (error) {
    console.error('Abandoned contacts cron error:', error)
    return NextResponse.json(
      {
        error: 'Failed to process abandoned contacts',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
