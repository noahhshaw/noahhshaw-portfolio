import { NextRequest, NextResponse } from "next/server";
import { getCurrentParent } from "@/lib/baby/session";
import {
  processSender,
  processAllPendingSenders,
} from "@/lib/baby/reply-processor";

export const runtime = "nodejs";
// Allow longer execution since this calls the Anthropic API.
export const maxDuration = 60;

// Reply processor HTTP surface.
//
// Triggered by:
//   1. The dashboard "Process pending now" button (session auth).
//   2. A periodic cron sweep via /api/cron/process-replies (no body).
//
// The inbound webhook calls processSender() in-process — no HTTP hop —
// so this route is only the manual + cron surface. See src/lib/baby/
// reply-processor.ts for the actual logic.

type ProcessRequestBody = {
  fromEmail?: string;
  triggerReplyId?: number;
};

export async function POST(request: NextRequest) {
  // Accept any of: BABY_INTERNAL_SECRET (routine), QStash signature
  // (legacy), or an authenticated parent session (manual trigger from
  // dashboard).
  const auth = request.headers.get("authorization");
  const upstashSig = request.headers.get("upstash-signature");
  const internalSecret = process.env.BABY_INTERNAL_SECRET;
  const internalAuthOk =
    !!internalSecret && auth === `Bearer ${internalSecret}`;
  const qstashAuthOk = !!upstashSig;
  let sessionAuthOk = false;
  if (!internalAuthOk && !qstashAuthOk) {
    const parent = await getCurrentParent();
    sessionAuthOk = !!parent;
  }
  if (!internalAuthOk && !qstashAuthOk && !sessionAuthOk) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: ProcessRequestBody = {};
  try {
    body = (await request.json()) as ProcessRequestBody;
  } catch {
    // sweep mode: no body
  }

  if (body.fromEmail) {
    const result = await processSender(body.fromEmail.toLowerCase());
    return NextResponse.json({ ok: true, results: [result] });
  }

  const results = await processAllPendingSenders();
  return NextResponse.json({ ok: true, results });
}
