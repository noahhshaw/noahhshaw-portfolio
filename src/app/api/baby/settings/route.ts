import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { agentSettings } from "@/db/schema";
import { getCurrentParent } from "@/lib/baby/session";

export const runtime = "nodejs";

// agent_settings is a key/value table. Both the daily routine and the reply
// agent read from it. UI lets either parent edit; last-write-wins (no
// notification per product spec).

export async function GET() {
  const parent = await getCurrentParent();
  if (!parent) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rows = await db.select().from(agentSettings);
  const map: Record<string, unknown> = {};
  for (const r of rows) map[r.key] = r.value;
  return NextResponse.json({ settings: map });
}

export async function PUT(request: NextRequest) {
  const parent = await getCurrentParent();
  if (!parent) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const entries = Object.entries(body);
  if (entries.length === 0) {
    return NextResponse.json({ ok: true, updated: 0 });
  }

  for (const [key, value] of entries) {
    await db
      .insert(agentSettings)
      .values({
        key,
        value: value as object,
        updatedByEmail: parent.email,
      })
      .onConflictDoUpdate({
        target: agentSettings.key,
        set: {
          value: value as object,
          updatedByEmail: parent.email,
          updatedAt: new Date(),
        },
      });
  }

  return NextResponse.json({ ok: true, updated: entries.length });
}
