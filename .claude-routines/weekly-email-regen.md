# Weekly email regeneration — recurring routine

Runs once a week. Regenerates the rolling next-14-days of pre-computed
daily emails so content stays fresh against milestone completions, KB
edits, calendar changes, and the advancing age window.

This is the recurring counterpart to `precompute-pipeline.md` (the
one-time / ad-hoc generation spec). It is wired to a weekly scheduled
task; it can also be run by hand any time.

## Cadence

Weekly, Monday ~08:00 local. Each run covers 14 days, so consecutive
runs overlap by ~7 days — that overlap is the buffer: if a run is
missed, the previous run's artifacts still cover the gap.

## Procedure

The agent (a fresh Claude Code session) does the following end to end.
Working directory: the repo root.

1. **Compute the range.** Determine Avi's current age in days:
   `ageInDays = floor((today - 2026-05-09) / 1 day)`.
   The target range is `[ageInDays + 1 .. ageInDays + 14]`.

2. **Pull current milestone state** so the check-in section reflects
   reality:
   `npm run milestones:status -- --json` (prints pending/eligible
   milestones for today). Note any milestones marked complete/skipped —
   those should NOT surface in the regenerated emails.

3. **Read the inputs** for each day in range:
   - `baby-kb/voice.md` (binding tone guide — re-read every run)
   - `baby-kb/buckets/week-NN.md` for each relevant week
   - 1-3 relevant `baby-kb/topics/*.md`
   - `baby-kb/calendars/*.json` for age-static events

4. **Author** each day as a `DailyContent` object (see
   `src/lib/baby/render-daily.ts` for the shape) following voice.md:
   five sections, no Further reading, 3-5 enrichment bullets, inline
   authority URLs. Use `scripts/regenerate-days-10-23.ts` as the
   template — copy it to `scripts/regenerate-days-<lo>-<hi>.ts`, swap
   in the new range and content, or extend the existing one.

5. **Render + write + auto-bake:** run the regen script. It calls
   `renderDaily()`, writes `baby-kb/precomputed/day-N.json` for each
   day, AND auto-runs `milestones:bake` for the full range at the end.
   Do not skip — without this, emails ship with no milestone section
   (the 2026-05-21 incident).

6. **Sanity-check milestones baked:**
   `grep -c "Developmental milestone check-in" baby-kb/precomputed/day-<N>.json`
   for at least one day in the range. Should return 2 (text + html).

7. **Validate:**
   `npm run precompute:validate`
   All target days must pass content + link checks. Fix and re-run on
   any failure (link timeouts on healthychildren.org are transient —
   re-run once before treating as real).

8. **Archive spent artifacts:** move any `day-N.json` where
   `N < ageInDays` into `baby-kb/precomputed/archive/` so the live set
   and `precompute:validate` stay clean.

9. **Verify build:** `npx tsc --noEmit && npm test`

10. **Commit + push:**
    `git add baby-kb/precomputed scripts/ && git commit && git push origin main`
    Vercel auto-deploys; the daily 14:00 UTC cron picks up the fresh
    artifacts.

11. **Report** a one-screen summary: range regenerated, word counts,
    validation result, deploy status, anything that needed a human.

## Guardrails

- Never hand-write `bodyHtml` — always go through `renderDaily()`.
- Never invent clinical facts — everything traces to the KB buckets /
  topics / AAP-CDC sources.
- If a `baby-kb/buckets/week-NN.md` for a needed week is missing, stop
  and flag it — do not improvise the week's clinical content.
- Past-day artifacts in `archive/` are immutable history. Do not edit.
- Keep each email's prose body 250-600 words (milestone section is
  exempt and added in step 6).

## Failure handling

- Validator fails after a fix attempt → stop, report the issues, leave
  artifacts uncommitted for human review.
- Vercel deploy not Ready within a few minutes → report; check
  `vercel ls` and the build logs.
- Vercel Hobby plan: cron schedules must be daily — do not add
  sub-daily crons to `vercel.json` (deploys silently fail).
