# Baby Agent — Setup

## Environment variables

Add to Vercel project env (and `.env.local` for dev):

```
# Existing (already configured)
DATABASE_URL=                       # Neon Postgres
RESEND_API_KEY=                     # Resend
UPSTASH_REDIS_REST_URL=             # Upstash Redis
UPSTASH_REDIS_REST_TOKEN=
ANTHROPIC_API_KEY=                  # Used by reply agent

# New for the baby app
BABY_SESSION_SECRET=                # 32+ random bytes, base64. Used to sign session cookies.
CRON_SECRET=                        # Optional. If set, cron requests must include Bearer token.
RESEND_INBOUND_WEBHOOK_SECRET=      # Optional but recommended. From Resend dashboard.
BABY_INTERNAL_SECRET=               # Optional. Auth for /api/baby/internal/* routes.
QSTASH_TOKEN=                       # Optional. Enables 10-min reply debounce.
NOTIFICATION_EMAIL=noahhshaw@gmail.com
```

Generate a session secret:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Database migration

The portfolio Neon DB already has the names-rater tables. To apply only the
new baby tables without touching the existing ones, use `push` (state diff):

```sh
DATABASE_URL=$(vercel env pull .env.local && grep ^DATABASE_URL .env.local | cut -d= -f2-) \
  npm run db:push
```

Or just run with the env var directly:

```sh
DATABASE_URL='postgres://...' npm run db:push
```

`drizzle-kit push` inspects the live database, diffs against the schema in
`src/db/schema.ts`, and applies only the missing CREATE TABLE / ALTER
statements. Safe to re-run.

A reference SQL migration is also checked in at `drizzle/0000_baby_agent.sql`
for production-grade migration tooling, but for this single-user app `push`
is the simplest path.

Then seed the baby profile (singleton row):

```sql
INSERT INTO baby_profile (due_date) VALUES ('2026-05-11');
```

Useful inspection commands:

```sh
npm run db:studio   # opens Drizzle Studio at https://local.drizzle.studio
```

Seed the AAP vaccine and well-visit calendars (will be loaded from
`baby-kb/calendars/*.json` once the research agent finishes; until then,
the table can be empty).

## Resend domain & inbound

1. Confirm `noahhshaw.com` is verified in Resend (you have this).
2. In Resend dashboard → **Domains → noahhshaw.com → Inbound**, enable inbound
   parsing for `daily-baby@noahhshaw.com`.
3. Set the inbound webhook URL to:
   ```
   https://noahhshaw.com/api/inbound/baby
   ```
4. Copy the webhook signing secret into `RESEND_INBOUND_WEBHOOK_SECRET`.
5. Add the required MX record from Resend's inbound setup screen to the domain
   in Cloudflare (or wherever `noahhshaw.com` DNS is hosted).

## Cron schedule

Vercel cron entry in `vercel.json`:

```json
{ "path": "/api/cron/baby-morning", "schedule": "0 14 * * *" }
```

That fires daily at 14:00 UTC = **7am PDT (March–November)** or 6am PST
(November–March). The route is idempotent (won't re-send if today's row
exists), so you can safely add a second entry at `0 15 * * *` for the
PST half-of-year if exact 7am-local matters and you're on Vercel Pro.

The route also supports `?force=1` for manual testing.

## Cloudflare R2 (photos)

1. Create a Cloudflare account (free tier).
2. Create an R2 bucket: `daily-bay-baby-photos`.
3. Generate an R2 API token with read+write to that bucket.
4. Add to env:
   ```
   R2_ACCOUNT_ID=
   R2_ACCESS_KEY_ID=
   R2_SECRET_ACCESS_KEY=
   R2_BUCKET=daily-bay-baby-photos
   R2_PUBLIC_BASE_URL=               # optional, if you've set up a custom domain
   ```

R2 free tier covers 10 GB storage + 1M Class A ops/mo — more than enough.

## QStash (optional, for 10-min reply debounce)

1. In the Upstash console, create a QStash project.
2. Copy `QSTASH_TOKEN` and add to env.
3. The inbound webhook auto-publishes a delayed processing job per reply.

Without QStash, replies are processed by the next cron sweep (latency:
hours).

## Claude routine

The daily render is primarily handled by a Claude routine (Max
subscription). Spec lives at `.claude-routines/baby-morning.md`. Register
via `claude.ai/code/routines` once the spec is finalized. The Vercel cron
(`/api/cron/baby-morning`) acts as a fallback if the routine misses.

## Manual smoke test

After deploying:

```sh
# Force a fallback render send
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://noahhshaw.com/api/cron/baby-morning?force=1"

# Open the dashboard
open https://noahhshaw.com/baby
```

## Whitelist

Magic-link login is restricted to:
- `noahhshaw@gmail.com` (Noah)
- `vaswani.anushka@gmail.com` (Anushka)

Edit `src/lib/baby/constants.ts` to change.
