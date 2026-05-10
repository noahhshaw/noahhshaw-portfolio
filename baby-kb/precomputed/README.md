# Pre-computed daily emails

One JSON file per `ageInDays`, named `day-{N}.json` (e.g. `day-0.json` for birth day, `day--3.json` for 3 days pre-birth, `day-365.json` for year-1 wrap).

## File format

```json
{
  "ageInDays": 7,
  "subject": "Day 7: schedule first-week visit; weight-regain window open",
  "bodyHtml": "<!doctype html>...",
  "bodyText": "Today's focus\n...",
  "citations": [
    "baby-kb/voice.md",
    "baby-kb/buckets/week-02.md",
    "baby-kb/topics/breastfeeding-vs-formula-vs-combo.md"
  ],
  "generatedAt": "2026-05-10T20:00:00Z",
  "kbVersion": "7398af4",
  "validationPassed": true
}
```

## Lifecycle

1. **Generation** happens in a Claude Code session (Opus 4.7) by an agent that reads the full `baby-kb/`, baby profile, settings, and calendar. The agent commits the resulting JSON files to this directory.
2. **Validation** is automatic on every generated file (see `src/lib/baby/validators.ts` + link checker). The agent re-drafts up to 3× on failure.
3. **Send** happens via the Vercel cron at 14:00 UTC: `/api/cron/baby-morning` reads `day-<today's-ageInDays>.json`, sends via Resend, and logs to `daily_emails`.
4. **No live AI at send time.** No fallback render. If the file is missing, the cron sends an error notice to `noahhshaw@gmail.com`.

## When to regenerate

The artifact is immutable until one of these inputs changes:
- `baby-kb/*` (KB content)
- `baby_profile` (birth date, baby name, pediatrician)
- `agent_settings` (voice intensity, enrichment intensity, topics enabled)
- `calendar_events` (Mother's Day, family birthdays, etc.)

When any of those change for production days, re-run the pre-compute pipeline in Claude Code for the affected range. Old files in this directory can be overwritten freely; the file is the source of truth.

## Test mode

For the initial validation pass, the agent generates 3 days (the first batch) and the gen-and-send script routes them to `noahhshaw@gmail.com` only (not Anushka). Once Noah confirms tone and format, the full year gets generated.

## What's NOT here

- Recipient list (in `agent_settings.recipients`, applied at send time)
- Calendar events (still baked in at gen time, but the recipient list and pause flag remain dynamic — those don't change *content*)
- Parent replies / parent_context (never accessible to the gen agent)
