# Baby Knowledge Base

Source-of-truth content for the daily baby agent (`/baby` app). The daily render and the inbound-reply agent both draw from these files.

## Layout

```
voice.md                    Tone guide (read by both daily render and reply agent)
sources.md                  Whitelisted sources used to seed the KB
buckets/week-NN.md          Per-week age guidance (52 files)
topics/*.md                 Evergreen deep-dives (sleep, feeding, enrichment, health)
calendars/*.json            Vaccines, well-visits, enrichment windows
dad/*.md                    Father-focused content (529, life insurance, paternity)
mom/*.md                    Postpartum, breastfeeding, return to work
schools/*.md                Preschool/elementary application timelines
```

## How content is rendered

The daily routine (or fallback Vercel cron) selects content by:

1. **Age bucket** — from baby's age in days, derived from `baby_profile.birth_date` (or `due_date` pre-birth)
2. **Active topics** — set by parent via config page or detected from prior replies
3. **Calendar window** — events in the next 14 days from `calendars/*.json` plus `calendar_events` table
4. **Recent context** — last 7 days of `parent_context` rows (replies, photo tags, manually-added notes)

The renderer follows the email structure prescribed in `voice.md`.

## Updating the KB

KB updates flow through PRs. Either:

- **Manual**: edit a file, open a PR
- **Agent-driven**: a parent reply classified as `feedback` or a request like "research X" is queued in `kb_update_queue`. A Claude routine (on Max subscription) picks up queued requests, researches, and opens a PR. Noah reviews and merges.

Never modify these files from the production runtime. The KB is read-only from the running app's perspective.
