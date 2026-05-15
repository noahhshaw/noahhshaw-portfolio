import { NextRequest, NextResponse } from "next/server";
import { getCurrentParent } from "@/lib/baby/session";
import {
  getDefaultBabyProfileId,
  loadAllMilestoneRows,
  MILESTONE_STATUSES,
  type MilestoneStatus,
} from "@/lib/baby/milestones";

export const runtime = "nodejs";

// Export milestones for sharing with the pediatrician.
//
// Query params:
//   ?format=csv|text  (default csv)
//   ?status=pending|complete|skipped  (omit for all)
//
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

  const url = request.nextUrl;
  const format = url.searchParams.get("format") === "text" ? "text" : "csv";
  const statusParam = url.searchParams.get("status");
  const status =
    statusParam && (MILESTONE_STATUSES as readonly string[]).includes(statusParam)
      ? (statusParam as MilestoneStatus)
      : null;

  const all = await loadAllMilestoneRows(babyId);
  const rows = status ? all.filter((r) => r.event.status === status) : all;

  if (format === "text") {
    const out = rows
      .map((r) => {
        const date =
          r.event.observedDate ?? r.event.completedAt?.toISOString().slice(0, 10) ?? "";
        const dateBit =
          r.event.status === "complete" && date
            ? ` (observed ${date})`
            : r.event.status === "skipped"
            ? " (skipped)"
            : " (pending)";
        const notesBit = r.event.notes ? ` — ${r.event.notes}` : "";
        return `${r.catalog.displayName}${dateBit}${notesBit}`;
      })
      .join("\n");
    const today = new Date().toISOString().slice(0, 10);
    const filename = `milestones-${today}.txt`;
    return new NextResponse(out + "\n", {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  const headers = [
    "category",
    "milestone",
    "status",
    "observed_date",
    "completed_at",
    "skipped_at",
    "notes",
    "aap_age_low_days",
    "aap_age_high_days",
    "source_url",
  ];
  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      [
        r.catalog.category,
        r.catalog.displayName,
        r.event.status,
        r.event.observedDate ?? "",
        r.event.completedAt?.toISOString() ?? "",
        r.event.skippedAt?.toISOString() ?? "",
        r.event.notes ?? "",
        r.catalog.ageWindowLowDays,
        r.catalog.ageWindowHighDays,
        r.catalog.sourceUrl,
      ]
        .map(csvEscape)
        .join(",")
    ),
  ];
  const today = new Date().toISOString().slice(0, 10);
  const filename = `milestones-${today}.csv`;
  return new NextResponse(lines.join("\n") + "\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
