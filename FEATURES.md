# Daily Baby — features & build verification

A check-list of every shipped feature with the verification step that proves it works. Run the **build gate** before merging anything to `main`.

## Build gate (must pass before push)

```sh
npm test                       # all unit tests (≥99 currently)
npm run db:check               # Drizzle schema matches production
npm run precompute:validate    # all baby-kb/precomputed/day-*.json pass content + link validation
./node_modules/.bin/tsc --noEmit  # no type errors
./node_modules/.bin/next build    # production build succeeds
```

Each push to `main` triggers a Vercel deploy. Verify the new deploy is `Ready` in `vercel ls` before declaring done.

---

## Feature inventory

| # | Feature | Owner code | How to verify |
|---|---|---|---|
| 1 | **Magic-link auth** for `/baby/*` | `src/lib/baby/auth.ts`, `/api/baby/auth/{request,verify,logout}/route.ts` | Visit `/baby/login`, request a link, click it from inbox, land on `/baby` dashboard |
| 2 | **Recipient list** stored in DB, editable from dashboard | `src/lib/baby/recipients-store.ts`, `/api/baby/recipients/route.ts`, `RecipientsSection.tsx` | Add/edit/remove rows in the Recipients section; reload to confirm persistence |
| 3 | **Baby profile** (due date, birth date, name, pediatrician) | `babyProfile` schema, `/api/baby/profile/route.ts`, `ProfileSection.tsx` | Edit and save; daily cron reads from this |
| 4 | **Settings** (voice intensity, enrichment intensity, topics, paused_until) | `agent_settings` (key/value JSON), `/api/baby/settings/route.ts`, `SettingsSection.tsx` | Toggle a slider, save, reload |
| 5 | **Personal calendar** (Mother's Day, birthdays, vaccines) | `calendar_events` schema, `/api/baby/calendar/route.ts`, recurrence engine in `recurrence.ts` | Add a yearly event for 2024-05-10; verify it surfaces in next-14-day window via gen pipeline |
| 6 | **Photo upload** (R2 path-style, confirm-after-upload) | `r2.ts`, `/api/baby/photos/{upload-url,confirm,...}/route.ts`, `PhotoSection.tsx` | Drag image into Photos section; appears in gallery |
| 7 | **Inbound replies** (Cloudflare Email Worker → HMAC POST → debounced classifier) | `cloudflare/email-worker/src/worker.ts`, `/api/inbound/baby/route.ts`, `/api/baby/internal/process-replies/route.ts`, `classifier.ts` | Reply to a daily email; verify entry appears in Reply log with classification |
| 8 | **Pre-compute pipeline** (Claude Code agent generates → JSON artifacts → committed to repo) | `.claude-routines/precompute-pipeline.md` (procedure), `baby-kb/precomputed/day-N.json` | `ls baby-kb/precomputed/ \| wc -l` ≥ days you've generated; `npm run precompute:validate` passes |
| 9 | **Daily cron** reads precomputed artifact, sends via Resend | `/api/cron/baby-morning/route.ts`, `src/lib/baby/send.ts` | `curl https://noahhshaw.com/api/cron/baby-morning?force=1&token=...` returns `ok: true`, email lands in inbox |
| 10 | **Missing-artifact notice** when day-N.json absent | Same cron route, `sendMissingArtifactNotice()` | Move/delete an artifact, force the cron, verify alert email arrives |
| 11 | **Forward-looking coverage check** (7-day lookahead) | Same cron route, `findCoverageGaps()` + `sendCoverageGapNotice()` | After today's send, if next 7 days have any gaps, a coverage-gap notice email arrives |
| 12 | **Voice contract enforcement** (validators) | `src/lib/baby/validators.ts`, 99 unit tests | `npm test` passes; `npm run precompute:validate` passes on every artifact |
| 13 | **Link checker** with browser User-Agent | `validators.ts → checkLinks()` | Bad URL in an artifact → validator reports the 4xx/5xx |
| 14 | **Pre-compute test-send** (route days to noahhshaw@gmail.com for review) | `/api/baby/test-send/route.ts` | Browser-navigate `/api/baby/test-send?days=0,7,14`; emails arrive in inbox |
| 15 | **KB-update queue** + reply log + dashboard review | `kb_update_queue` schema, `/api/baby/kb-queue`, `KbQueueSection.tsx`, `ReplyLogSection.tsx` | Reply with "change the format to X"; classifier queues a feedback item; dashboard shows it |
| 16 | **Vercel cron schedule** at 14:00 UTC daily | `vercel.json` crons block | Vercel dashboard → Crons; see next run; check `daily_emails` table after each |

---

## End-to-end smoke test (full system)

After any architectural change, run this top-to-bottom:

1. `npm test` — 99/99 pass
2. `npm run precompute:validate` — all artifacts pass content + link checks
3. `./node_modules/.bin/next build` — clean
4. Push to main
5. `vercel ls` — wait for `Ready`
6. Browser-navigate `/api/baby/test-send?days=0,7,14&to=noahhshaw@gmail.com`
7. Check inbox: 3 emails arrive within 30 seconds
8. Read each email:
   - Subject begins `[TEST DAY N]` then `Day N:`
   - Six sections present: Today's focus, Action items, Watch-fors, Enrichment opportunity, Upcoming, Further reading
   - Severity flags `[low concern] / [monitor] / [call within 24h] / [call now]` in Watch-fors
   - At least one inline external URL per fact-bearing claim
   - Further reading has ≥2 bullets, each with a URL
   - No `baby-kb/...` paths visible in body
   - Anoushka spelled correctly (no `Anushka`)
   - All links clickable and load to non-error pages
9. Send a reply to any of the test emails
10. Within ~10 min (or click "Process pending now" in dashboard), confirm:
    - Reply appears in Reply log with classification
    - If classified as feedback, an entry appears in Pending KB updates

---

## Known operational gotchas

- Vercel Hobby cap: 2 cron jobs total. Currently used by `abandoned-contacts` and `baby-morning`. Anything else needs QStash.
- R2 needs `forcePathStyle: true` (we set it; don't remove it).
- Anthropic API key in env is only used for **inbound reply classifier**, not for email gen.
- Email gen is done in **Claude Code session** with Opus 4.7. No production API cost for gen.
- After a KB change, re-run the pre-compute pipeline for affected days (currently manual; agent + operator).
