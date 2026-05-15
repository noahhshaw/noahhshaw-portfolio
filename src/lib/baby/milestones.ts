/**
 * Milestones library — pure query + render helpers shared between the
 * dashboard, the email pipeline, and CLI scripts. No HTTP, no React.
 *
 * Surfacing rule (locked in):
 *   surfaceable(ageInDays) =
 *     event.status = 'pending'
 *     AND catalog.age_window_low_days <= ageInDays
 *
 * No upper cutoff — past-window pending items keep surfacing so the
 * parent has a chance to mark them. The dashboard adds a soft visual
 * badge for "past the AAP window" without anxiety framing.
 */

import { db } from "@/db";
import {
  babyProfile,
  milestoneEvents,
  milestonesCatalog,
  type MilestoneCatalog,
  type MilestoneEvent,
} from "@/db/schema";
import { and, asc, desc, eq, lte } from "drizzle-orm";

export type MilestoneStatus = "pending" | "complete" | "skipped";
export const MILESTONE_STATUSES: readonly MilestoneStatus[] = [
  "pending",
  "complete",
  "skipped",
] as const;

export type MilestoneCategory =
  | "social-emotional"
  | "language-communication"
  | "cognitive"
  | "movement-gross"
  | "movement-fine";

export const MILESTONE_CATEGORY_LABELS: Record<MilestoneCategory, string> = {
  "social-emotional": "Social & emotional",
  "language-communication": "Language & communication",
  cognitive: "Cognitive",
  "movement-gross": "Movement — gross motor",
  "movement-fine": "Movement — fine motor",
};

/** Catalog + per-baby event joined for display. */
export type MilestoneRow = {
  catalog: MilestoneCatalog;
  event: MilestoneEvent;
  pastWindow: boolean;
};

/**
 * Fetch the singleton baby profile id. We have one baby; if that changes,
 * callers can pass a babyProfileId explicitly to other helpers.
 */
export async function getDefaultBabyProfileId(): Promise<number | null> {
  const rows = await db
    .select({ id: babyProfile.id })
    .from(babyProfile)
    .orderBy(asc(babyProfile.id))
    .limit(1);
  return rows[0]?.id ?? null;
}

/**
 * Idempotent: ensure every catalog row has a matching event row for the
 * given baby profile, with status='pending'. Safe to call repeatedly.
 */
export async function ensureBabyEventsExist(babyProfileId: number): Promise<{
  inserted: number;
}> {
  const cat = await db.select().from(milestonesCatalog);
  const existing = await db
    .select({ milestoneId: milestoneEvents.milestoneId })
    .from(milestoneEvents)
    .where(eq(milestoneEvents.babyProfileId, babyProfileId));
  const have = new Set(existing.map((e) => e.milestoneId));
  const toInsert = cat
    .filter((c) => !have.has(c.id))
    .map((c) => ({
      babyProfileId,
      milestoneId: c.id,
      status: "pending" as const,
    }));
  if (toInsert.length > 0) {
    await db.insert(milestoneEvents).values(toInsert);
  }
  return { inserted: toInsert.length };
}

/** All catalog × event rows for a baby, sorted by seed_order. */
export async function loadAllMilestoneRows(
  babyProfileId: number
): Promise<MilestoneRow[]> {
  const rows = await db
    .select()
    .from(milestonesCatalog)
    .innerJoin(
      milestoneEvents,
      and(
        eq(milestoneEvents.milestoneId, milestonesCatalog.id),
        eq(milestoneEvents.babyProfileId, babyProfileId)
      )
    )
    .orderBy(asc(milestonesCatalog.seedOrder));

  return rows.map(({ milestones_catalog, milestone_events }) => ({
    catalog: milestones_catalog,
    event: milestone_events,
    pastWindow: false, // caller fills in with current ageInDays
  }));
}

/**
 * Surface-eligible rows for the email check-in: pending only, low_days <=
 * ageInDays. Capped at `limit`. Sorted **newest-opened first** —
 * `age_window_low_days DESC, seed_order ASC` — so the daily email
 * highlights milestones that just became expected rather than repeating
 * the same day-0 list forever. Older still-pending items remain visible
 * on the dashboard for catch-up review.
 */
export async function loadSurfaceableMilestones(opts: {
  babyProfileId: number;
  ageInDays: number;
  limit?: number;
}): Promise<MilestoneRow[]> {
  const limit = opts.limit ?? 5;
  const rows = await db
    .select()
    .from(milestonesCatalog)
    .innerJoin(
      milestoneEvents,
      and(
        eq(milestoneEvents.milestoneId, milestonesCatalog.id),
        eq(milestoneEvents.babyProfileId, opts.babyProfileId)
      )
    )
    .where(
      and(
        eq(milestoneEvents.status, "pending"),
        lte(milestonesCatalog.ageWindowLowDays, opts.ageInDays)
      )
    )
    .orderBy(
      desc(milestonesCatalog.ageWindowLowDays),
      asc(milestonesCatalog.seedOrder)
    )
    .limit(limit);

  return rows.map(({ milestones_catalog, milestone_events }) => ({
    catalog: milestones_catalog,
    event: milestone_events,
    pastWindow: opts.ageInDays > milestones_catalog.ageWindowHighDays,
  }));
}

/**
 * Apply a status change. Idempotent — repeating the same status is a
 * no-op for fields other than `updatedAt`.
 */
export async function updateMilestoneStatus(opts: {
  babyProfileId: number;
  catalogKey: string;
  status: MilestoneStatus;
  observedDate?: string | null;
  notes?: string | null;
}): Promise<MilestoneRow | null> {
  const catRow = await db
    .select()
    .from(milestonesCatalog)
    .where(eq(milestonesCatalog.key, opts.catalogKey))
    .limit(1);
  if (!catRow[0]) return null;

  const now = new Date();
  const completedAt = opts.status === "complete" ? now : null;
  const skippedAt = opts.status === "skipped" ? now : null;
  const observedDate =
    opts.observedDate === undefined
      ? undefined
      : opts.observedDate || null;

  const setClause: Partial<MilestoneEvent> = {
    status: opts.status,
    completedAt,
    skippedAt,
    updatedAt: now,
  };
  if (observedDate !== undefined) setClause.observedDate = observedDate;
  if (opts.notes !== undefined) setClause.notes = opts.notes;

  await db
    .update(milestoneEvents)
    .set(setClause)
    .where(
      and(
        eq(milestoneEvents.babyProfileId, opts.babyProfileId),
        eq(milestoneEvents.milestoneId, catRow[0].id)
      )
    );

  const after = await db
    .select()
    .from(milestoneEvents)
    .where(
      and(
        eq(milestoneEvents.babyProfileId, opts.babyProfileId),
        eq(milestoneEvents.milestoneId, catRow[0].id)
      )
    )
    .limit(1);
  if (!after[0]) return null;
  return {
    catalog: catRow[0],
    event: after[0],
    pastWindow: false,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Render helpers — kept pure (no DB) so the email pipeline can call them
// with whatever rows it already loaded.
// ─────────────────────────────────────────────────────────────────────

export type CheckInRenderInput = {
  rows: MilestoneRow[];
  /** Origin where the magic link resolves. e.g. "https://www.noahhshaw.com". */
  origin: string;
};

/** Plain-text email fragment. Empty string if no rows. */
export function renderCheckInText(input: CheckInRenderInput): string {
  if (input.rows.length === 0) return "";
  const lines: string[] = [];
  lines.push("Developmental milestone check-in");
  lines.push(
    "Tap any link to mark it complete. View or change others at " +
      `${input.origin}/baby/milestones`
  );
  lines.push("");
  for (const r of input.rows) {
    lines.push(`- ${r.catalog.displayName}`);
    lines.push(
      `  AAP window: day ${r.catalog.ageWindowLowDays}-${r.catalog.ageWindowHighDays}` +
        (r.pastWindow ? " (past expected window)" : "")
    );
    if (r.catalog.clinicalNote) {
      lines.push(`  What to look for: ${r.catalog.clinicalNote}`);
    }
    lines.push(`  Source: ${r.catalog.sourceUrl}`);
    lines.push(
      `  Mark complete: ${input.origin}/baby/milestones/${r.catalog.key}/complete`
    );
    lines.push("");
  }
  return lines.join("\n");
}

/** HTML email fragment. Empty string if no rows.
 *
 * The wrapper uses max-width:620px;margin:0 auto so it center-aligns inside
 * the email's body — the pre-computed artifact uses the same 620px column,
 * so this card visually matches.
 */
export function renderCheckInHtml(input: CheckInRenderInput): string {
  if (input.rows.length === 0) return "";
  const items = input.rows
    .map((r) => {
      const window = `Day ${r.catalog.ageWindowLowDays}-${r.catalog.ageWindowHighDays}`;
      const pastBadge = r.pastWindow
        ? ` <span style="color:#92400e;font-size:11px;background:#fef3c7;padding:2px 6px;border-radius:4px;margin-left:6px">past expected window</span>`
        : "";
      const completeUrl = `${input.origin}/baby/milestones/${r.catalog.key}/complete`;
      const sourceAnchor = `<a href="${r.catalog.sourceUrl}" style="color:#1d4ed8;text-decoration:none">source</a>`;
      const description = r.catalog.clinicalNote
        ? `<div style="font-size:13px;color:#4b5563;margin:0 0 10px;line-height:1.5">${escapeHtml(r.catalog.clinicalNote)}</div>`
        : "";
      return `
    <li style="margin:0 0 18px;padding:0;list-style:none">
      <div style="font-weight:600;color:#111827;line-height:1.35">${escapeHtml(r.catalog.displayName)}${pastBadge}</div>
      <div style="font-size:12px;color:#6b7280;margin:3px 0 8px">${window} &middot; ${sourceAnchor}</div>
      ${description}
      <a href="${completeUrl}" style="display:inline-block;padding:7px 14px;background:#1d4ed8;color:#ffffff;text-decoration:none;border-radius:6px;font-size:13px;font-weight:500">Mark complete</a>
    </li>`;
    })
    .join("");
  return `
<div style="max-width:620px;margin:20px auto 0;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:24px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1f2937;line-height:1.55">
  <h2 style="margin:0 0 6px;font-size:14px;text-transform:uppercase;letter-spacing:0.05em;color:#111827">Developmental milestone check-in</h2>
  <p style="margin:0 0 18px;color:#4b5563;font-size:13px">Tap to mark any of these complete when you've seen them. <a href="${input.origin}/baby/milestones" style="color:#1d4ed8">Manage all milestones</a>.</p>
  <ul style="margin:0;padding:0">${items}
  </ul>
</div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
