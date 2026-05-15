import { NextRequest, NextResponse } from "next/server";
import { getCurrentParent } from "@/lib/baby/session";
import {
  getDefaultBabyProfileId,
  ensureBabyEventsExist,
  loadAllMilestoneRows,
  MILESTONE_STATUSES,
  type MilestoneStatus,
} from "@/lib/baby/milestones";
import { loadAgeContext } from "@/lib/baby/age";

export const runtime = "nodejs";

// List per-baby milestones. Filter by status with ?status=pending|complete|skipped.
// Auth: parent session.

export async function GET(request: NextRequest) {
  const parent = await getCurrentParent();
  if (!parent) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const babyId = await getDefaultBabyProfileId();
  if (!babyId) {
    return NextResponse.json(
      { error: "no baby profile configured" },
      { status: 400 }
    );
  }
  await ensureBabyEventsExist(babyId);

  const url = request.nextUrl;
  const statusParam = url.searchParams.get("status");
  const status =
    statusParam && (MILESTONE_STATUSES as readonly string[]).includes(statusParam)
      ? (statusParam as MilestoneStatus)
      : null;

  const all = await loadAllMilestoneRows(babyId);
  const age = await loadAgeContext();
  const ageInDays = age?.ageInDays ?? -999;
  const rows = all
    .map((r) => ({
      ...r,
      pastWindow: ageInDays > r.catalog.ageWindowHighDays,
    }))
    .filter((r) => (status ? r.event.status === status : true));

  return NextResponse.json({
    ok: true,
    babyId,
    ageInDays,
    count: rows.length,
    statuses: MILESTONE_STATUSES,
    rows: rows.map((r) => ({
      key: r.catalog.key,
      displayName: r.catalog.displayName,
      category: r.catalog.category,
      ageWindowLowDays: r.catalog.ageWindowLowDays,
      ageWindowHighDays: r.catalog.ageWindowHighDays,
      sourceUrl: r.catalog.sourceUrl,
      clinicalNote: r.catalog.clinicalNote,
      seedOrder: r.catalog.seedOrder,
      status: r.event.status,
      observedDate: r.event.observedDate,
      completedAt: r.event.completedAt,
      skippedAt: r.event.skippedAt,
      notes: r.event.notes,
      pastWindow: r.pastWindow,
    })),
  });
}
