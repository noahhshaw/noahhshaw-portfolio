# Pre-compute pipeline — Claude Code session spec

This is the procedure the operator (Noah) and the agent (this Claude Code session, Opus 4.7) follow to generate the year's worth of daily emails. Run ad-hoc. Not a scheduled routine. No API calls.

## When to run

- First-time bootstrap (generate the year)
- After a KB-update PR merges (regenerate affected days)
- After a calendar or settings change (regenerate affected days)
- After Noah edits the baby profile (regenerate all days)

## Pre-flight

The operator confirms in chat:
- Which `ageInDays` range to generate (e.g. `--days=0..30`, `0..6`, `--all`)
- Whether to use **test mode** (route to `noahhshaw@gmail.com` only) or **prod mode** (commit artifacts to `baby-kb/precomputed/`)
- Any specific calendar dates the agent should weave in (or rely on `calendar_events` in DB — operator pastes the live state)

## Inputs the agent receives

The operator pastes or the agent reads (via Read tool):

1. **`baby-kb/voice.md`** — binding tone guide (re-read every run)
2. **`baby-kb/buckets/week-NN.md`** for each `weekIndex = floor(age/7) + 1`
3. **Relevant `baby-kb/topics/*.md`** the agent selects based on the bucket's "what's coming next"
4. **`baby-kb/calendars/{vaccines,well-visits}.json`** for age-static events
5. **Baby profile**: birth date 2026-05-09, name Avi, pronouns he/him, pediatrician (TBD)
6. **`calendar_events`** snapshot — operator pastes the rows or the agent queries via the diag endpoint

## Process per day

For each `ageInDays` in the requested range, the agent:

1. **Determines weekIndex** = `Math.max(1, Math.floor(age / 7) + 1)`; if `age < 0`, frame as "preparing for arrival"
2. **Reads** voice.md, the bucket file, 1–3 relevant topic files, the AAP calendars
3. **Computes static calendar slice**: any vaccine/well-visit/family-date that falls in the 14-day window after `ageInDays`
4. **Drafts** the email as structured `DailyContent` (see `src/lib/baby/render-daily.ts`), following voice.md exactly:
   - Subject `Day N: {most important info}` (≤72 chars)
   - Five sections: Today's focus / Action items / Watch-fors (severity-flagged) / Enrichment opportunities (3-5 bullets) / Upcoming
   - **No "Further reading" / "Source" section** — authority URLs go inline on the claim
   - Inline links to authority sources (CDC, AAP, NIH) where a bullet rests on a specific claim
   - Citations list of `baby-kb/...` paths
5. **Renders** the structured content with `renderDaily()` → `{ bodyText, bodyHtml }`. Never hand-write HTML — the renderer is the single template source.
6. **Validates** content (`src/lib/baby/validators.ts → validateEmail`) and links (`checkLinks` via `npm run precompute:validate`)
7. **Writes** `baby-kb/precomputed/day-{ageInDays}.json`:
   ```json
   {
     "ageInDays": <N>,
     "subject": "...",
     "citations": ["baby-kb/..."],
     "generatedAt": "<ISO timestamp>",
     "kbVersion": "<version tag>",
     "validationPassed": true,
     "bodyText": "...",
     "bodyHtml": "..."
   }
   ```
8. **Bakes** the milestone check-in section: `npm run milestones:bake -- --days=<range>`. This appends the "Developmental milestone check-in" block — the gen agent does NOT author it.

The practical pattern (see `scripts/regenerate-days-10-23.ts`): author the `DailyContent` objects in a regen script, call `renderDaily`, write artifacts, then bake + validate. Spent past-day artifacts live in `baby-kb/precomputed/archive/`.

## Test-mode flow (first 3 days)

For the initial bootstrap, **before** the full year:

1. Operator asks for 3 representative days (e.g., 0, 7, 14)
2. Agent generates each, validates, writes JSON files
3. Operator commits artifacts
4. Operator triggers `/api/baby/test-send?days=0,7,14&to=noahhshaw@gmail.com` (a separate endpoint to be wired up)
5. Operator reviews emails in Gmail
6. If passes review, operator asks for full year generation

## After full generation

1. Operator commits all `baby-kb/precomputed/day-*.json` files
2. Pushes to main
3. Vercel auto-deploys
4. Daily cron at 14:00 UTC takes over

## Re-generation triggers

| Trigger | Affected days |
|---|---|
| KB PR merged | All days that cite changed files (or all if voice.md changed) |
| Profile birth_date changed | All days (ageInDays math shifts) |
| Profile baby_name changed | All days |
| Settings (voice/enrichment intensity, topics) changed | All days |
| Calendar event added/removed | Days whose 14-day window includes the changed date |

The agent flags affected days, regenerates, and commits replacements.

## Cost

Zero API cost — generation runs in Claude Code session. Operator's only cost is wall-clock time in conversation.

## Failure modes

- **Validator fails after 3 retries**: agent stops, reports to operator with the issues. Operator decides: fix the KB, relax validators, or skip the day.
- **Link checker times out**: agent logs the URL, treats as broken if 3× retries fail.
- **Bucket file missing**: agent stops and asks operator to add `baby-kb/buckets/week-NN.md` first.
