/**
 * Notification Service
 * Sends email notifications to Noah about chatbot activity
 *
 * Notifications sent for:
 * - Contact intent started (even if abandoned)
 * - Successful message sent
 * - Abandoned contact attempts (daily digest)
 */

import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const NOAH_EMAIL = process.env.NOTIFICATION_EMAIL || 'noahhshaw@gmail.com'
const FROM_EMAIL = 'Portfolio Bot <onboarding@resend.dev>' // Use Resend sandbox initially

interface ContactNotificationData {
  name: string
  email: string
  company?: string
  reason?: string
  message?: string
  conversationId?: string
}

/**
 * Notify Noah when someone starts a contact attempt
 * (Even if they don't complete it - per PRD)
 */
export async function notifyContactIntentStarted(data: ContactNotificationData): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.log('[Notifications] Resend not configured, skipping notification')
    return
  }

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: NOAH_EMAIL,
      subject: `[Portfolio] Contact attempt started: ${data.name}`,
      text: `Someone started filling out the contact form on your portfolio.

Details:
- Name: ${data.name}
- Email: ${data.email}
${data.company ? `- Company: ${data.company}` : ''}
${data.reason ? `- Reason: ${data.reason}` : ''}
${data.conversationId ? `- Conversation ID: ${data.conversationId}` : ''}

Note: This contact attempt may or may not be completed. You'll receive another notification if they actually send the message.

---
Sent from noahhshaw.com portfolio chatbot`,
    })

    console.log('[Notifications] Contact intent notification sent')
  } catch (error) {
    console.error('[Notifications] Failed to send contact intent notification:', error)
  }
}

/**
 * Notify Noah when a message is successfully sent
 */
export async function notifyMessageSent(data: ContactNotificationData): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.log('[Notifications] Resend not configured, skipping notification')
    return
  }

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: NOAH_EMAIL,
      reply_to: data.email,
      subject: `[Portfolio] New message from ${data.name}`,
      text: `You have a new message from your portfolio website!

From: ${data.name} <${data.email}>
${data.company ? `Company: ${data.company}` : ''}
${data.reason ? `Reason for contact: ${data.reason}` : ''}

Message:
${data.message}

---
Reply directly to this email to respond to ${data.name}.
Sent from noahhshaw.com portfolio chatbot`,
    })

    console.log('[Notifications] Message sent notification delivered')
  } catch (error) {
    console.error('[Notifications] Failed to send message notification:', error)
  }
}

/**
 * Notify Noah about an abandoned contact attempt
 */
export async function notifyAbandonedContact(data: ContactNotificationData): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.log('[Notifications] Resend not configured, skipping notification')
    return
  }

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: NOAH_EMAIL,
      subject: `[Portfolio] Abandoned contact: ${data.name || 'Unknown'}`,
      text: `A contact attempt was started but not completed on your portfolio.

Details collected before abandonment:
- Name: ${data.name || 'Not provided'}
- Email: ${data.email || 'Not provided'}
${data.company ? `- Company: ${data.company}` : ''}
${data.conversationId ? `- Conversation ID: ${data.conversationId}` : ''}

This person showed interest but didn't complete the contact form.

---
Sent from noahhshaw.com portfolio chatbot`,
    })

    console.log('[Notifications] Abandoned contact notification sent')
  } catch (error) {
    console.error('[Notifications] Failed to send abandoned contact notification:', error)
  }
}

/**
 * Send a daily digest of chatbot activity (optional - can be triggered by cron)
 */
export async function sendDailyDigest(stats: {
  totalConversations: number
  conversationsToday: number
  messagesReceived: number
  abandonedContacts: number
  costToday: number
  costThisMonth: number
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    return
  }

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: NOAH_EMAIL,
      subject: `[Portfolio] Daily chatbot digest`,
      text: `Daily summary of your portfolio chatbot activity:

Today's Activity:
- Conversations: ${stats.conversationsToday}
- Messages received: ${stats.messagesReceived}
- Abandoned contacts: ${stats.abandonedContacts}

Cost Tracking:
- Today: $${stats.costToday.toFixed(4)}
- This month: $${stats.costThisMonth.toFixed(4)}

All-Time:
- Total conversations: ${stats.totalConversations}

---
Sent from noahhshaw.com portfolio chatbot`,
    })

    console.log('[Notifications] Daily digest sent')
  } catch (error) {
    console.error('[Notifications] Failed to send daily digest:', error)
  }
}
