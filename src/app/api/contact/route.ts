import { NextRequest, NextResponse } from 'next/server'
import { notifyMessageSent, notifyContactIntentStarted } from '@/lib/notifications'
import {
  markContactAttemptStarted,
  markContactAttemptCompleted,
} from '@/lib/conversation-logger'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      name,
      email,
      message,
      company,
      reason,
      conversationId,
      notifyIntentOnly, // Flag to just notify about intent without sending full message
    } = body

    // Handle intent notification (when user starts filling form)
    if (notifyIntentOnly) {
      if (name || email) {
        await notifyContactIntentStarted({
          name: name || 'Unknown',
          email: email || 'Not provided',
          company,
          reason,
          conversationId,
        })

        if (conversationId) {
          await markContactAttemptStarted(conversationId, name, email, company)
        }
      }

      return NextResponse.json({ success: true }, { status: 200 })
    }

    // Validate required fields for full message
    if (!name || !email || !message) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      )
    }

    // Send notification email to Noah
    await notifyMessageSent({
      name,
      email,
      company,
      reason,
      message,
      conversationId,
    })

    // Mark contact as completed in logs
    if (conversationId) {
      await markContactAttemptCompleted(conversationId)
    }

    return NextResponse.json(
      { success: true },
      { status: 200 }
    )
  } catch (error) {
    console.error('Contact form error:', error)
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    )
  }
}
