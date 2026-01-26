# Chatbot Setup Guide

Complete guide to setting up the AI-powered chatbot with database logging and email notifications.

---

## Overview

Your portfolio now includes a production-ready chatbot with:

- ✅ **RAG System**: Answers questions using only canonical data about you
- ✅ **Intent Classification**: Detects when users want to contact you
- ✅ **Rate Limiting**: Per-IP, session, and circuit breaker protection
- ✅ **Cost Controls**: Hard caps at $5/day and $100/month
- ✅ **Voice Input**: Web Speech API transcription
- ✅ **Persistent Storage**: Upstash Redis for logs and tracking
- ✅ **Email Notifications**: Alerts via Resend
- ✅ **Conversation Logging**: 5-year retention with anonymized IPs

---

## Required Environment Variables

Add these to your Vercel project (Settings → Environment Variables):

### 1. Anthropic API (Required for chatbot)

```
ANTHROPIC_API_KEY=sk-ant-api03-...
```

**Get it from:** https://console.anthropic.com/settings/keys

**Cost:** ~$0.01-0.03 per conversation (Claude Sonnet 4)

---

### 2. Resend API (Required for notifications)

```
RESEND_API_KEY=re_...
```

**Get it from:** https://resend.com/api-keys

**Setup:**
1. Create free account at https://resend.com
2. Generate API key
3. Verify your domain (optional - uses sandbox initially)
4. Notifications will be sent to `noahhshaw@gmail.com`

**Cost:** Free tier includes 3,000 emails/month

---

### 3. Upstash Redis (Optional but recommended)

```
UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
UPSTASH_REDIS_REST_TOKEN=AYa...
```

**Get it from:** https://console.upstash.com

**Setup:**
1. Create free account
2. Create a new Redis database
3. Select region closest to your Vercel deployment
4. Copy REST URL and token from database details page

**What happens without Redis:**
- Falls back to in-memory storage
- Rate limits reset on every deployment
- Conversation logs lost on redeploy
- Cost tracking resets daily

**Cost:** Free tier includes 10,000 commands/day

---

### 4. IP Salt (Optional)

```
IP_SALT=some_random_string_12345
```

Used to anonymize IP addresses in conversation logs. If not set, uses a default value.

---

## Vercel Deployment Steps

1. **Push changes to GitHub** (already done ✓)

2. **Add environment variables in Vercel:**
   - Go to https://vercel.com/your-username/noahhshaw-portfolio
   - Settings → Environment Variables
   - Add each variable above
   - Select all environments (Production, Preview, Development)

3. **Redeploy:**
   - Go to Deployments tab
   - Click the three dots on latest deployment
   - Select "Redeploy"
   - Or just push a new commit

4. **Verify setup:**
   - Visit your deployed site
   - Open browser console (F12)
   - Try the chatbot
   - Check for errors

---

## Email Notifications

You'll receive emails at `noahhshaw@gmail.com` for:

### 1. Contact Intent Started
Sent when someone fills in their name and email (even if they don't complete the form).

**Subject:** `[Portfolio] Contact attempt started: [Name]`

**Contains:**
- Name, email, company, reason
- Conversation ID for reference

### 2. Message Sent
Sent when someone successfully submits the contact form.

**Subject:** `[Portfolio] New message from [Name]`

**Contains:**
- Full message content
- Reply-To set to their email for easy response

### 3. Abandoned Contacts (Future)
Can be triggered via cron job to report incomplete contact attempts.

---

## Conversation Logging

All chatbot conversations are logged to Redis with:

- Anonymized IP (SHA-256 hash)
- Full message history
- Timestamps
- Token usage
- Contact attempt status
- **5-year retention** (per PRD)

### Viewing Logs

Logs can be retrieved via the conversation logger functions:

```typescript
import { getRecentConversations, getConversationStats } from '@/lib/conversation-logger'

// Get last 50 conversations
const recent = await getRecentConversations(50)

// Get statistics
const stats = await getConversationStats()
// Returns: { totalConversations, conversationsToday, pendingContacts }
```

---

## Cost Tracking

The chatbot enforces hard limits:

- **Daily:** $5 maximum
- **Monthly:** $100 maximum (rolling 30 days)

When limits are exceeded, the chatbot:
1. Automatically disables
2. Shows fallback contact form
3. Resets at the appropriate time boundary

### Monitoring Costs

Check current usage:

```typescript
import { getUsageStats } from '@/lib/rate-limiter'

const stats = await getUsageStats()
// Returns: { dailyCost, monthlyCost, dailyCostLimit, monthlyCostLimit }
```

Or check Anthropic console: https://console.anthropic.com/settings/usage

---

## Rate Limiting

Multiple layers of protection:

| Type | Limit | Reset |
|------|-------|-------|
| Per IP | 10 requests/minute | 60 seconds |
| Circuit Breaker | 100 requests/hour | 1 hour |
| Per Session | 12 turns | 8 minutes |
| Input Tokens | 3,000 max | Per conversation |
| Output Tokens | 1,500 max | Per conversation |

---

## Testing Locally

1. **Copy environment variables:**
   ```bash
   cp .env.local .env.local.example  # (if you want to save a template)
   ```

2. **Add your API keys to `.env.local`**

3. **Run dev server:**
   ```bash
   npm run dev
   ```

4. **Test the chatbot at:**
   http://localhost:3000/#contact

5. **Check Redis (optional):**
   ```bash
   # Install Upstash CLI
   npm install -g @upstash/cli

   # View data
   upstash redis get conv:...
   ```

---

## Troubleshooting

### Chatbot not responding
- Check ANTHROPIC_API_KEY is set
- Check browser console for errors
- Verify you're not rate limited (wait 1 minute)

### Notifications not sending
- Check RESEND_API_KEY is set
- Verify email address in src/lib/notifications.ts
- Check Resend dashboard for delivery status

### Redis errors
- Verify UPSTASH_REDIS_REST_URL and TOKEN are correct
- Check Upstash dashboard for connection issues
- Site will work without Redis (in-memory fallback)

### Build errors
- Run `npm install` to ensure all dependencies are installed
- Check for TypeScript errors: `npm run build`

---

## Monitoring & Maintenance

### Daily
- Check email for contact attempts
- Monitor Anthropic usage dashboard

### Weekly
- Review conversation logs for quality
- Check for abandoned contacts (may indicate UX issues)

### Monthly
- Review cost tracking (should be < $100)
- Check Upstash storage usage
- Rotate IP_SALT if desired

---

## Security Notes

- IP addresses are anonymized via SHA-256 hashing
- System prompts never exposed to users
- Noah's email never shown to users
- Conversations encrypted at rest in Redis
- Rate limiting prevents abuse
- Hard cost caps prevent runaway bills

---

## Future Enhancements

Possible additions (not currently implemented):

1. **Admin Dashboard**
   - View conversation logs
   - Monitor costs in real-time
   - Export data

2. **Automated Abandonment Emails**
   - Cron job to check pending contacts
   - Send daily digest to Noah

3. **Conversation Search**
   - Full-text search in logs
   - Filter by date/intent

4. **A/B Testing**
   - Different system prompts
   - Response style variations

5. **Analytics**
   - Most common questions
   - Conversion rate (conversation → contact)

---

## Support

If you encounter issues:

1. Check this guide
2. Review error logs in Vercel dashboard
3. Check Upstash and Resend dashboards
4. Review the PRD: `requirements/chatbot_requirements.txt`

---

**Last Updated:** January 2026
