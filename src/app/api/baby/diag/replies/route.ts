import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { emailReplies } from "@/db/schema";
import { desc, sql } from "drizzle-orm";
import { getCurrentParent } from "@/lib/baby/session";
import { redis, isRedisConfigured } from "@/lib/redis";

export const runtime = "nodejs";
export const maxDuration = 30;

// Diagnostic endpoint: list recent email replies with their processing
// state. Surfaces what the agent decided, what was sent (if anything),
// and any error — without needing a database client.
//
// Query params:
//   ?limit=N           — how many rows (default 20, max 100)
//   ?sender=foo@bar    — filter by from_email
//   ?unprocessed=1     — only rows with processed_at IS NULL
//
// Auth: parent session cookie OR Authorization: Bearer <BABY_INTERNAL_SECRET>.

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const internalSecret = process.env.BABY_INTERNAL_SECRET;
  const internalOk =
    !!internalSecret && auth === `Bearer ${internalSecret}`;
  if (!internalOk) {
    const parent = await getCurrentParent();
    if (!parent) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const url = request.nextUrl;
  const limit = Math.min(
    Number(url.searchParams.get("limit") ?? "20") || 20,
    100
  );
  const sender = url.searchParams.get("sender")?.toLowerCase().trim() || null;
  const unprocessedOnly = url.searchParams.get("unprocessed") === "1";

  // Drizzle's where-builder gets noisy here; the raw SQL is clearer.
  const rows = await db.execute(sql`
    SELECT id, from_email, subject, received_at, processed_at,
           classification, action_taken, processing_error,
           agent_response_message_id,
           length(body_text) AS body_len,
           LEFT(message_id, 80) AS message_id_short,
           daily_email_id
    FROM email_replies
    ${sender ? sql`WHERE from_email = ${sender}` : sql``}
    ${unprocessedOnly && sender ? sql`AND processed_at IS NULL` : sql``}
    ${unprocessedOnly && !sender ? sql`WHERE processed_at IS NULL` : sql``}
    ORDER BY received_at DESC
    LIMIT ${limit}
  `);

  // Surface the current Redis lock state for senders we're looking at —
  // useful to see if a stuck mutex is what's blocking processing.
  const senderSet = new Set<string>();
  // drizzle's execute() returns { rows } in pg context
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const list: any[] = Array.isArray(rows)
    ? rows
    : (rows as { rows?: unknown[] }).rows ?? [];
  for (const r of list) {
    const e = (r as { from_email?: string }).from_email;
    if (e) senderSet.add(e);
  }
  const locks: Record<string, string | null> = {};
  if (isRedisConfigured()) {
    for (const s of senderSet) {
      try {
        const v = await redis.get(`baby:processing:${s}`);
        locks[s] = (v as string | null) ?? null;
      } catch {
        locks[s] = "redis-error";
      }
    }
  }

  return NextResponse.json({
    ok: true,
    count: list.length,
    rows: list,
    locks,
    filters: { limit, sender, unprocessedOnly },
  });
}

// POST: same as GET but also kicks the processor for the listed senders.
// Useful from curl: easy way to "run pending now" without the dashboard.
export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const internalSecret = process.env.BABY_INTERNAL_SECRET;
  const internalOk =
    !!internalSecret && auth === `Bearer ${internalSecret}`;
  if (!internalOk) {
    const parent = await getCurrentParent();
    if (!parent) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const body = (await request.json().catch(() => ({}))) as {
    fromEmail?: string;
  };
  const { processSender, processAllPendingSenders } = await import(
    "@/lib/baby/reply-processor"
  );

  if (body.fromEmail) {
    const result = await processSender(body.fromEmail.toLowerCase());
    return NextResponse.json({ ok: true, result });
  }
  const results = await processAllPendingSenders();
  return NextResponse.json({ ok: true, results });
}

// DELETE: clear stuck per-sender Redis lock(s). Safety valve when a worker
// died mid-processing without releasing.
export async function DELETE(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const internalSecret = process.env.BABY_INTERNAL_SECRET;
  const internalOk =
    !!internalSecret && auth === `Bearer ${internalSecret}`;
  if (!internalOk) {
    const parent = await getCurrentParent();
    if (!parent) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const sender = request.nextUrl.searchParams.get("sender")?.toLowerCase().trim();
  if (!sender) {
    return NextResponse.json(
      { error: "?sender=<email> required" },
      { status: 400 }
    );
  }
  if (!isRedisConfigured()) {
    return NextResponse.json({ ok: true, cleared: false, reason: "redis not configured" });
  }
  const cleared = await redis.del(`baby:processing:${sender}`);
  return NextResponse.json({ ok: true, cleared: cleared === 1, sender });
}

// Keep desc imported to satisfy tree-shaking in older Drizzle versions.
void desc;
