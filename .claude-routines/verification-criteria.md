# Daily Baby — pre-deploy and post-deploy verification criteria

Concrete, runnable checks that a change to the daily email pipeline is
safe to ship and that production is actually behaving correctly. Used by
the weekly regen routine and by operators after any non-trivial change.

## A. Pre-deploy (run locally before pushing)

A change is safe to deploy when **every** check below returns the
expected result. The first failure stops the deploy.

| # | Check | Command | Pass criteria |
|---|---|---|---|
| A1 | TypeScript compiles | `npx tsc --noEmit` | Exit 0, no errors |
| A2 | Unit tests | `npm test` | All tests pass, no skipped |
| A3 | Production build | `npm run build` | Exit 0; all expected routes appear in the build output |
| A4 | Pre-computed artifacts pass content + link checks | `npm run precompute:validate` | `N/N passed.` where N = number of live `day-*.json` files (archived files in `precomputed/archive/` are excluded) |
| A5 | Milestone section is present in every age-eligible artifact | (part of A4 — fails with "missing milestone section in bodyText/Html" when broken) | No `missing milestone section` issues |
| A6 | Milestone section is NOT present in any age-ineligible artifact | (part of A4 — fails with "milestone section present but no catalog row is eligible") | No `milestone section present but…` issues |

### A.1 What A4-A6 actually enforce

`validateEmail()` now takes `milestonesExpected: boolean`. The validate
script computes this per-artifact from `baby-kb/milestones/aap-cdc-2022.json`:
`age_window_low_days <= artifact.ageInDays` for any catalog row.

- If `milestonesExpected = true` and the section is missing from either
  `bodyText` or `bodyHtml` → **fail** with a remediation hint:
  `run 'npm run milestones:bake -- --days=N'`
- If `milestonesExpected = false` and the section is present → **fail**
  ("stale bake; regenerate")

The 2026-05-21 incident — three days of emails went out missing the
section because a regen wrote fresh JSON and the bake step was skipped
— is caught by A5.

## B. Post-deploy (run against production after each push)

| # | Check | Command | Pass criteria |
|---|---|---|---|
| B1 | Vercel deploy is Ready and recent | `vercel ls \| grep Production \| head -1` | Top row is `● Ready` and aged <5 min |
| B2 | Diag endpoint reachable | `curl -s -o /dev/null -w "%{http_code}" "$ORIGIN/api/baby/diag/replies?limit=1" -H "Authorization: Bearer $BABY_INTERNAL_SECRET"` | `200` |
| B3 | Daily artifact lookup works for the current age | `curl -s "$ORIGIN/api/baby/diag/replies?limit=1" -H "Authorization: Bearer $BABY_INTERNAL_SECRET" \| jq .ok` | `true` |
| B4 | Today's daily-email row is present in the DB | Dashboard `/baby` → Email log shows today's row with `status="sent"` | Row exists; non-null `resendMessageId` |

`$ORIGIN` = `https://www.noahhshaw.com`. `$BABY_INTERNAL_SECRET` is in
`.env.local` after `vercel env pull` + manual paste (Sensitive var).

## C. End-to-end reply pipeline (run when classifier or processor changes)

This is the only check that exercises the full Cloudflare worker →
Vercel inbound → classifier → Resend send path with a real message.

1. While logged in to `/baby`, hit
   `$ORIGIN/api/baby/test-send?days=<current-age>&to=noahhshaw@gmail.com`
   in browser. JSON response should be `{"results":[{"day":N,"status":"sent","messageId":"..."}], ...}`.
2. The email lands in inbox within ~5 seconds.
3. **Verify the email**:
   - Subject is `[TEST DAY N] Day N: …`
   - Body has all 5 required sections (Today's focus, Action items,
     Watch-fors, Enrichment opportunities, Upcoming)
   - **Developmental milestone check-in card is at the bottom** with up
     to 5 items, each showing name, AAP window, source link, description,
     "Mark complete" button
4. **Reply** to the email with a real question.
5. Within ~10 seconds, the **response arrives**:
   - In the **same Gmail conversation** (threaded)
   - **Only to addresses on your reply** (audience correct)
   - **Plain prose, no markdown bleed**, hyperlinked sources
   - Has the quoted history of your reply preserved
6. **Confirm the trace**:
   ```bash
   curl -s "$ORIGIN/api/baby/diag/trace?limit=12" \
     -H "Authorization: Bearer $BABY_INTERNAL_SECRET" \
     | jq '.events[] | {stage, replyId: .data.replyId, durationMs: .data.durationMs, replyTextLen: .data.replyTextLen, sendError: .data.sendError}'
   ```
   - `proc.classify.done` has `replyTextLen > 0` and `durationMs < 15000`
   - `proc.send.done` has no `sendError`
   - No `proc.classify.empty-text` events (would indicate truncation
     regression)
7. **Confirm the DB state**:
   ```bash
   curl -s "$ORIGIN/api/baby/diag/replies?limit=3" \
     -H "Authorization: Bearer $BABY_INTERNAL_SECRET" \
     | jq '.rows[] | {id, action_taken, agent_response_message_id, processing_error}'
   ```
   - The new row has `action_taken="replied"` and a non-null
     `agent_response_message_id`

## D. Daily morning self-check (automated)

The `baby-morning` cron now performs two checks after the daily send and
emails Noah if anything is wrong:

- **Coverage gap**: any of the next 7 days missing a `day-N.json`?
- **Unresponded replies**: any `email_replies` row received >1h ago and
  <48h ago with no `agent_response_message_id` and either no
  `processed_at` or `action_taken` in
  `('send-failed','classify-failed','classify-empty-reply','send-unknown')`?

A failing check produces a structured email with reply ids, ages,
failure reasons, and pointers to `/api/baby/diag/*` for triage. The
first morning after a failure is when this fires — no need to poll.

## E. Failure recovery

| Symptom | First diagnostic | Recovery |
|---|---|---|
| `precompute:validate` fails with "missing milestone section" | none — message is self-explanatory | `npm run milestones:bake -- --days=<N>` then re-validate |
| Test send arrives without milestone card | `grep -c "Developmental milestone check-in" baby-kb/precomputed/day-<N>.json` | If 0, run the bake; if 2, the send pipeline is dropping it — check `src/lib/baby/send.ts` |
| Reply received but no response | `curl /api/baby/diag/trace?level=error&limit=20` | If `proc.classify.empty-text` → max_tokens still being hit; bump again; if `proc.send.threw` → resend API error |
| Cron fired but no email sent | `curl /api/baby/diag/replies?unprocessed=1` plus `vercel logs` | Most often a missing artifact — `sendMissingArtifactNotice` will have fired |
| `vercel env pull` returns empty values | Vercel marks the var Sensitive | Manual paste of the value from Vercel dashboard into `.env.local` |
