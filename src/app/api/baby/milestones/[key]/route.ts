import { NextRequest, NextResponse } from "next/server";
import { getCurrentParent } from "@/lib/baby/session";
import {
  getDefaultBabyProfileId,
  updateMilestoneStatus,
  MILESTONE_STATUSES,
  type MilestoneStatus,
} from "@/lib/baby/milestones";

export const runtime = "nodejs";

// PATCH /api/baby/milestones/[key]
// Body: { status?: 'pending'|'complete'|'skipped', observedDate?: 'YYYY-MM-DD'|null, notes?: string|null }
// Any field omitted is left untouched.

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const parent = await getCurrentParent();
  if (!parent) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { key } = await params;
  const babyId = await getDefaultBabyProfileId();
  if (!babyId) {
    return NextResponse.json(
      { error: "no baby profile configured" },
      { status: 400 }
    );
  }

  let body: {
    status?: string;
    observedDate?: string | null;
    notes?: string | null;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (
    body.status !== undefined &&
    !(MILESTONE_STATUSES as readonly string[]).includes(body.status)
  ) {
    return NextResponse.json(
      { error: `status must be one of ${MILESTONE_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  // If the caller didn't specify a new status (notes/observedDate-only
  // edit), keep the current status. Otherwise apply the new one.
  let nextStatus = body.status as MilestoneStatus | undefined;
  if (!nextStatus) {
    const { loadAllMilestoneRows } = await import("@/lib/baby/milestones");
    const all = await loadAllMilestoneRows(babyId);
    const found = all.find((r) => r.catalog.key === key);
    if (!found) {
      return NextResponse.json({ error: "milestone not found" }, { status: 404 });
    }
    nextStatus = found.event.status as MilestoneStatus;
  }

  const result = await updateMilestoneStatus({
    babyProfileId: babyId,
    catalogKey: key,
    status: nextStatus,
    observedDate: body.observedDate,
    notes: body.notes,
  });
  if (!result) {
    return NextResponse.json({ error: "milestone not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    row: {
      key: result.catalog.key,
      displayName: result.catalog.displayName,
      status: result.event.status,
      observedDate: result.event.observedDate,
      completedAt: result.event.completedAt,
      skippedAt: result.event.skippedAt,
      notes: result.event.notes,
    },
  });
}
