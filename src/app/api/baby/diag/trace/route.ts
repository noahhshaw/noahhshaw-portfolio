import { NextRequest, NextResponse } from "next/server";
import { readRecentTrace } from "@/lib/baby/trace";
import { getCurrentParent } from "@/lib/baby/session";

export const runtime = "nodejs";
export const maxDuration = 15;

// Surfaces the last N structured trace events written by the inbound webhook
// and the reply processor. Backed by a Redis ring buffer (`baby:trace:recent`),
// so it works even when Vercel function logs have rolled off.
//
// Query params:
//   ?limit=N         — how many events (default 50, max 200)
//   ?traceId=foo     — filter to one correlation id
//   ?stage=proc.*    — filter by stage prefix
//   ?level=error     — filter by level
//
// Auth: parent session OR Authorization: Bearer <BABY_INTERNAL_SECRET>.

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
    Number(url.searchParams.get("limit") ?? "50") || 50,
    200
  );
  const traceFilter = url.searchParams.get("traceId");
  const stagePrefix = url.searchParams.get("stage");
  const level = url.searchParams.get("level");

  const events = await readRecentTrace(limit);
  const filtered = events.filter((e) => {
    if (traceFilter && e.traceId !== traceFilter) return false;
    if (stagePrefix && !e.stage.startsWith(stagePrefix)) return false;
    if (level && e.level !== level) return false;
    return true;
  });

  return NextResponse.json({
    ok: true,
    count: filtered.length,
    filtersApplied: {
      limit,
      traceId: traceFilter ?? null,
      stage: stagePrefix ?? null,
      level: level ?? null,
    },
    events: filtered,
  });
}
