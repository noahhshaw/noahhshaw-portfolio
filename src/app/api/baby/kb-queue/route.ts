import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { kbUpdateQueue } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { getCurrentParent } from "@/lib/baby/session";

export const runtime = "nodejs";

export async function GET() {
  const parent = await getCurrentParent();
  if (!parent) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rows = await db
    .select()
    .from(kbUpdateQueue)
    .orderBy(desc(kbUpdateQueue.requestedAt))
    .limit(50);
  return NextResponse.json({ queue: rows });
}

type PatchBody = {
  id: number;
  status?: "queued" | "in-progress" | "pr-opened" | "merged" | "rejected";
  prUrl?: string;
  notes?: string;
};

export async function PATCH(request: NextRequest) {
  const parent = await getCurrentParent();
  if (!parent) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!Number.isFinite(body.id)) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (body.status) patch.status = body.status;
  if (body.prUrl !== undefined) patch.prUrl = body.prUrl;
  if (body.notes !== undefined) patch.notes = body.notes;
  if (
    body.status &&
    ["merged", "rejected", "pr-opened"].includes(body.status)
  ) {
    patch.completedAt = new Date();
  }

  const updated = await db
    .update(kbUpdateQueue)
    .set(patch)
    .where(eq(kbUpdateQueue.id, body.id))
    .returning();
  return NextResponse.json({ entry: updated[0] });
}
