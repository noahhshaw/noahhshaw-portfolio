# Routine: baby-kb-research

**Schedule (UTC):** `0 */6 * * *` — every 6 hours. Light work; usually exits without doing anything.

**Purpose:** Pick up `kb_update_queue` rows in `queued` state, research the requested topic, and open a GitHub PR against `noahshaw/noahhshaw-portfolio` updating files under `baby-kb/`. Noah reviews and merges; the dashboard tracks state via the queue's status workflow.

**Required MCP connectors:**
- **GitHub** (must be able to: create branch, write file, open PR on `noahshaw/noahhshaw-portfolio`)
- **HTTP** (read/update queue at `/api/baby/kb-queue`)
- **Web search / fetch** (to gather sources)

**Required environment variables:**
- `BABY_INTERNAL_SECRET`
- `BABY_API_BASE` = `https://noahhshaw.com`
- `KB_REPO_OWNER` = `noahshaw`
- `KB_REPO_NAME` = `noahhshaw-portfolio`
- `KB_BASE_BRANCH` = `main`

---

## Routine prompt body

```
You research and propose KB updates for the Daily Baby agent. Run every 6
hours.

## Step 1 — Look for queued requests

GET ${BABY_API_BASE}/api/baby/kb-queue with header
"Authorization: Bearer ${BABY_INTERNAL_SECRET}".
Filter response to entries with status="queued". If none, exit silently.

## Step 2 — Pick one request

Take the oldest queued entry. PATCH the same endpoint with
{ id, status: "in-progress" } so concurrent invocations skip it.

## Step 3 — Research

The request_text describes what the parent wants the agent to learn or
update. Examples:
- "Please learn about X bottle warmer brand and recommend it if good"
- "Update the daycare topic to mention SF Children's Center"
- "Add Anushka's birthday March 12 as a yearly recurring event"

For factual research:
- Use web search/fetch to find authoritative sources matching the
  whitelist in baby-kb/sources.md (AAP, CDC, Cochrane, Emily Oster,
  etc.). Avoid the explicit blacklist in that file.
- Cite inline.
- If the request is about local/personal data (a date, a name, a
  preference), do NOT do web research; just propose the edit directly.

## Step 4 — Propose the edit

Decide which file(s) under baby-kb/ should change:
- Topic deep-dives → topics/
- Per-week guidance → buckets/week-NN.md
- Calendar dates → calendars/personal.json (create if missing)
- Source whitelist → sources.md
- Voice tweaks → voice.md (be conservative; voice changes are high-impact)

Style match: every file in baby-kb/ follows the structure already in
place. Stay in the HBS-finance-mom voice from voice.md. Cite sources
inline. Add severity flags where applicable.

## Step 5 — Open PR

Branch name: `claude/kb/${kb_id}-${short-slug}` (e.g.,
`claude/kb/42-add-anushka-bday`).

Create branch from KB_BASE_BRANCH on the GitHub repo. Apply file edits.
Open a PR titled "KB: ${request_text first 60 chars}" with a body that
includes:
- The original request_text (quote)
- Which files changed and why
- Sources used (with URLs)
- Severity assessment (low / medium / high impact on agent behavior)

## Step 6 — Update queue

PATCH /api/baby/kb-queue with { id, status: "pr-opened", prUrl: <url>, notes: <one-line summary> }.

## Step 7 — Stop

Process exactly ONE entry per invocation. The next run picks the next.

## Failure handling

If at any step you fail (research dead-ends, can't open PR, etc.):
PATCH /api/baby/kb-queue with { id, status: "rejected", notes: <reason> }.
Then exit. Do not retry.
```

---

## Why ad-hoc, not real-time

Per Noah's spec: KB updates are research tasks, not part of the production
hot path. The 6-hour cadence is enough — there's no realtime requirement
once the request is queued.

## Notes

- The routine **never** writes directly to production DB; it goes through
  the queue and PR workflow. No risk of poisoning the live KB.
- The KB queue table includes a `target_topic` column the routine can use
  to disambiguate intent if the request_text is ambiguous; otherwise leave
  null and let the routine decide.
