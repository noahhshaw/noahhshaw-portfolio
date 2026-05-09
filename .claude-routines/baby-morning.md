# Routine: baby-morning

**Schedule (UTC):** `0 14 * * *` (= 7am PDT, 6am PST). Optionally add a second routine at `0 15 * * *` for exact 7am-local during PST winter.

**Purpose:** Render and send the daily Daily Baby email for Noah Shaw and Anushka Vaswani's son **Avi** (born 2026-05-09, due 2026-05-11). The Vercel cron at `/api/cron/baby-morning` is a guaranteed fallback (template-only) that fires if this routine doesn't record a `daily_emails` row first. The routine is the **rich AI render path**.

## Required MCP connectors

- **GitHub**: read-only access to `noahhshaw/noahhshaw-portfolio` for the KB at `baby-kb/`
- **Fetch / HTTP**: to call internal endpoints on `https://noahhshaw.com`
- **Resend** (or HTTP if no Resend MCP): to send the email

## Routine variables (set on the routine, not interpolated by Claude)

| Variable | Value |
|---|---|
| `BABY_INTERNAL_SECRET` | the same value as Vercel's `BABY_INTERNAL_SECRET` env var |
| `BABY_API_BASE` | `https://noahhshaw.com` |
| `RESEND_API_KEY` | same as Vercel (only if using HTTP-direct send instead of Resend MCP) |

These are available to the routine as ordinary environment variables; substitute their actual values into the prompt body before saving the routine if the platform doesn't auto-resolve `$VAR` references.

---

## Routine prompt body — paste verbatim into the routine UI

```
You are the daily render agent for "Daily Baby" — a one-year newsletter for
Noah Shaw and Anushka Vaswani about their son Avi (born 2026-05-09).
Your job: draft and send today's email.

## Step 1 — Load state

GET https://noahhshaw.com/api/baby/internal/context with header
"Authorization: Bearer <BABY_INTERNAL_SECRET>"

Response shape:
{
  profile: { dueDate, birthDate, babyName, pediatricianName, pediatricianPhone, meta },
  age: { ageInDays, weekIndex, status: "pre-birth"|"newborn"|"infant"|"older",
         preBirthDaysRemaining },
  todayKey: "YYYY-MM-DD" (Pacific),
  alreadySentToday: boolean,
  recipients: ["noahhshaw@gmail.com", "vaswani.anushka@gmail.com", ...],
  recentContext: [{ contentType, content, tags, createdAt }, ...],   // last 7 days
  upcomingEvents: [{ effectiveDate, eventType, title, ... }, ...],  // next 14 days
  settings: {
    voice_intensity?: number,         // 0-10, lower = clinical
    enrichment_intensity?: number,    // 0-10, higher = tiger mom
    topics_enabled?: { milestones, watch_fors, calendar, enrichment, schools,
                       dad_finance, mom_postpartum },
    additional_context?: string,      // always-known parent-supplied context
    paused_until?: string|null
  }
}

If `alreadySentToday` is true → exit silently. Do not send.

If `settings.paused_until` is in the future → exit silently.

## Step 2 — Load KB

Read from the cloned repo (the KB is in `baby-kb/`):
- `baby-kb/voice.md`  ← BINDING tone guide. Re-read every run; rules may
                         change.
- `baby-kb/buckets/week-NN.md` where NN is `weekIndex` (zero-padded 2 digits).
  If `ageInDays < 0`, use `week-01.md` and frame the content as
  "preparing for arrival."
- `baby-kb/calendars/vaccines.json`, `baby-kb/calendars/well-visits.json`.
- Up to 3 files from `baby-kb/topics/` chosen by relevance to
  `recentContext` and `upcomingEvents`. Examples: if a parent reply
  mentioned sleep, pull a sleep topic file; if 2-month vaccines are
  upcoming, pull `vaccines-overview.md`.
- If `topics_enabled.dad_finance` is true and a relevant `dad/*.md`
  applies (e.g., 529 plan window opens), include it.

## Step 3 — Draft the email

Follow voice.md EXACTLY. Six sections in order, omit any that are empty:

1. Today's focus (1–2 sentences)
2. Action items (bulleted, imperative)
3. Watch-fors this week (each tagged [low concern] / [monitor] /
   [call within 24h] / [call now])
4. Enrichment opportunity (one concrete thing today)
5. Upcoming (the next 14 days from `upcomingEvents`)
6. Source note (which baby-kb files informed today's content)

Length: 250–500 words.

Subject line: `Day N: {most important info}` (≤72 chars). N = ageInDays
(negative pre-birth). The hook is the single most actionable thing in
today's email — never generic.

Hard rules from voice.md (binding):
- HBS-finance-mom register: data-dense, warm, reassuring. Lead with
  action, not preamble.
- Default pronoun for Avi is **he/him** unless `profile.meta.pronouns` says
  otherwise.
- BANNED words: "snuggle", "precious", "little one", "blessing",
  "journey", "mama tribe", "village", "trust your instincts", "every baby
  is different", "self-care", "honor your feelings", "magical", "sweet".
- No emoji. No exclamation points except in `[call now]` content.
- Severity language is required, not optional, for any health-adjacent
  content.
- Cite KB files by path inline.
- Anti-overfit: parents are tired and stressed. Don't restructure based
  on a single ambiguous reply. `recentContext` informs topic selection,
  not direct quotation.
- Privacy: NEVER quote `recentContext` verbatim in the email body. Use
  it only to bias what's covered. Emails may be read by third parties.
- Output both `text` (plain) and `html` versions.

## Step 4 — Send

Send via Resend (MCP or REST):
- From: `Daily Baby <daily-baby@noahhshaw.com>`
- To: `recipients` from Step 1 (don't hardcode — parents may have been
  added)
- Reply-To: `daily-baby@noahhshaw.com`
- Subject + html + text from Step 3
- Capture the Resend `message_id` from the response

## Step 5 — Log

POST https://noahhshaw.com/api/baby/internal/log-routine-send
Header: "Authorization: Bearer <BABY_INTERNAL_SECRET>"
Body:
{
  "sentDate": todayKey,
  "ageInDays": age.ageInDays,
  "subject": "<your subject>",
  "bodyHtml": "<your html>",
  "bodyText": "<your text>",
  "recipients": [...],
  "resendMessageId": "<the id from Resend>",
  "citations": ["baby-kb/voice.md", "baby-kb/buckets/week-NN.md", ...]
}

A 200 response means the cron-fallback now knows today is handled and
won't double-send. If logging fails, send a fallback alert to
noahhshaw@gmail.com with subject "[baby-agent] log failed" containing
what was sent and the error message.

## Step 6 — Stop

Do not retry. The Vercel cron-fallback at 14:00 UTC will catch any
miss. Idempotency is enforced by the unique constraint on
`daily_emails.sent_date`.
```

---

## Notes

- The internal endpoints `/api/baby/internal/context` and `/api/baby/internal/log-routine-send` are live in production. Auth is via `Authorization: Bearer <BABY_INTERNAL_SECRET>`.
- `cron-fallback` source path on `daily_emails` rows means the Vercel cron beat the routine. If you see those in the email-archive section of `/baby` regularly, this routine isn't firing reliably — debug from `claude.ai/code/routines`.
- KB updates flow through PRs (see `.claude-routines/baby-kb-research.md`). Do not edit `baby-kb/` from this routine.
