# Cloudflare Email Worker — `baby-email-router`

Receives mail to `daily-baby@noahhshaw.com` (via Cloudflare Email Routing),
parses MIME, and POSTs an HMAC-signed JSON payload to the Vercel-hosted
`/api/inbound/baby` endpoint.

## Deploy (one-time)

```sh
cd cloudflare/email-worker
npm install
npx wrangler login                  # browser flow

# Set the two secrets the worker needs
npx wrangler secret put INBOUND_WEBHOOK_URL
# paste: https://noahhshaw.com/api/inbound/baby

npx wrangler secret put INBOUND_WEBHOOK_SECRET
# paste a fresh 32-byte base64 secret. Generate with:
#   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

npm run deploy
```

The same secret value must be set in Vercel as `INBOUND_WEBHOOK_SECRET` so
the Vercel route can verify signatures.

## Wire it to inbound mail

In the Cloudflare dashboard:

1. Pick the `noahhshaw.com` zone
2. **Email → Email Routing**
3. Click **Get started** if not already enabled. Cloudflare adds the MX
   records automatically (DNS is already there).
4. **Routing rules → Create address**:
   - Custom address: `daily-baby`
   - Action: **Send to a Worker**
   - Worker: `baby-email-router`
5. Save.

Test by sending any email to `daily-baby@noahhshaw.com` from your phone.
Use `npx wrangler tail baby-email-router` in another terminal to watch
the worker logs in real time.

## Tail logs

```sh
npx wrangler tail baby-email-router
```

## Update worker after code changes

```sh
npm run deploy
```

## Why a Worker, not a forward-to-mailbox

Forwarding to a Gmail inbox would let us read replies but not handle
attachments programmatically and not enforce the 10-minute debounce. The
Worker preserves the full MIME envelope and signs the request so the
Vercel side knows it's authentic.
