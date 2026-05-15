import { NextRequest, NextResponse } from "next/server";
import { processAllPendingSenders } from "@/lib/baby/reply-processor";

export const runtime = "nodejs";
export const maxDuration = 60;

// Cron backstop for the reply processor.
//
// Inbound webhooks trigger processSender() in-process — fast path. This
// cron runs daily at 13:00 UTC (6am Pacific, an hour before the morning
// email) and sweeps any sender with unprocessed replies, in case the
// inline trigger failed (cold-start timeout, transient Anthropic 5xx,
// function crash, BABY_INTERNAL_SECRET misconfigured, etc).
//
// NOTE: Vercel Hobby plan only allows daily cron jobs. If we upgrade to
// Pro, drop this to */5 or */15 for faster recovery. Until then, the
// dashboard "Process pending now" button and /api/baby/diag/replies POST
// are the human-in-the-loop recovery paths for sub-24h failures.
//
// Idempotent by construction: the per-sender Redis mutex inside
// processSender bails fast if another invocation is already running.
//
// Auth: Vercel cron sends `Authorization: Bearer <CRON_SECRET>` if
// CRON_SECRET is configured. We also accept BABY_INTERNAL_SECRET for
// manual curl + parity with the internal route.

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const tokenParam = request.nextUrl.searchParams.get("token");
  const provided = auth?.replace("Bearer ", "") || tokenParam;
  const cronSecret = process.env.CRON_SECRET;
  const internalSecret = process.env.BABY_INTERNAL_SECRET;
  const ok =
    (cronSecret && provided === cronSecret) ||
    (internalSecret && provided === internalSecret);
  if ((cronSecret || internalSecret) && !ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const results = await processAllPendingSenders();
  return NextResponse.json({ ok: true, swept: results.length, results });
}
