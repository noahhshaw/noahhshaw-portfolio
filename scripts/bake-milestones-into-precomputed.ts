/* eslint-disable no-console */
/**
 * Bake the "Developmental milestone check-in" section into the
 * pre-computed day-N.json artifacts.
 *
 * Catalog state is read from disk (baby-kb/milestones/aap-cdc-2022.json)
 * — NO database access required. For each day N, surfaceable rows are
 * those whose age_window_low_days <= N. Capped at 5, sorted by
 * seed_order. This matches what loadSurfaceableMilestones returns at
 * the moment when no events have been marked complete.
 *
 * After parents start marking items, you can either (a) accept that
 * the baked-in section is now slightly stale until you re-gen the
 * affected days, or (b) re-run this script which will surface the
 * same items regardless of state — for state-aware baking, use the
 * production /api/baby/milestones endpoint to fetch current state and
 * pipe it in via the --status-file flag (TODO when needed).
 *
 * Usage:
 *   npm run milestones:bake -- --days=6-19
 *   npm run milestones:bake -- --days=6,10,15
 *   npm run milestones:bake -- --days=all
 *
 * Completed / skipped milestones:
 *   The catalog on disk has no per-baby state, so by default this bakes
 *   the pending-default view (every eligible row). When the parent has
 *   already marked items complete or skipped, pass their catalog keys so
 *   they are dropped and the next still-pending eligible row backfills —
 *   matching production loadSurfaceableMilestones (status='pending'):
 *
 *     npm run milestones:bake -- --days=25-42 --exclude=brief-head-lift,calms-with-soothing
 *     npm run milestones:bake -- --days=25-42 --exclude-file=completed-milestones.json
 *
 *   --exclude-file points at a JSON file shaped either as a bare array
 *   of keys (["brief-head-lift", ...]) or { "excludeKeys": [...] }.
 *
 * Idempotent: removes any previously-injected milestone section before
 * adding the fresh one, so re-running with the same catalog (and the same
 * exclude set) produces the same output.
 */
import { promises as fs } from "fs";
import { resolve } from "path";

const ORIGIN = process.env.SITE_ORIGIN ?? "https://www.noahhshaw.com";
const CATALOG_FILE = "baby-kb/milestones/aap-cdc-2022.json";
const ARTIFACT_DIR = "baby-kb/precomputed";

type CatalogJson = {
  version: string;
  milestones: Array<{
    key: string;
    display_name: string;
    category: string;
    age_window_low_days: number;
    age_window_high_days: number;
    source_url: string;
    clinical_note?: string;
    seed_order: number;
  }>;
};

type CatalogRow = CatalogJson["milestones"][number];

type Artifact = {
  ageInDays: number;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  citations: string[];
  generatedAt?: string;
  kbVersion?: string;
  validationPassed?: boolean;
};

const MILESTONE_HEADER = "Developmental milestone check-in";
const MILESTONE_HTML_MARKER = `<!-- milestone-checkin-start -->`;
const MILESTONE_HTML_END = `<!-- milestone-checkin-end -->`;

function parseDayArg(arg: string | undefined): number[] | "all" {
  if (!arg || arg === "all") return "all";
  const days: Set<number> = new Set();
  for (const part of arg.split(",")) {
    const m = /^(\d+)-(\d+)$/.exec(part.trim());
    if (m) {
      const lo = Number(m[1]);
      const hi = Number(m[2]);
      for (let n = lo; n <= hi; n++) days.add(n);
    } else {
      const n = Number(part.trim());
      if (Number.isFinite(n)) days.add(n);
    }
  }
  return Array.from(days).sort((a, b) => a - b);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function surfaceable(
  catalog: CatalogRow[],
  ageInDays: number,
  excludeKeys: Set<string> = new Set()
): CatalogRow[] {
  // Match loadSurfaceableMilestones in production: pending-only (we model
  // "pending" by dropping the parent's completed/skipped keys), newest-
  // opened first, tiebreak by seed_order. So the daily email surfaces
  // milestones that just became expected, not the same day-0 list every
  // day — and never re-surfaces something the parent already marked.
  return catalog
    .filter((c) => c.age_window_low_days <= ageInDays)
    .filter((c) => !excludeKeys.has(c.key))
    .sort((a, b) => {
      if (b.age_window_low_days !== a.age_window_low_days)
        return b.age_window_low_days - a.age_window_low_days;
      return a.seed_order - b.seed_order;
    })
    .slice(0, 5);
}

function renderHtml(rows: CatalogRow[], ageInDays: number): string {
  if (rows.length === 0) return "";
  const items = rows
    .map((r) => {
      const past = ageInDays > r.age_window_high_days;
      const pastBadge = past
        ? ` <span style="color:#92400e;font-size:11px;background:#fef3c7;padding:2px 6px;border-radius:4px;margin-left:6px">past expected window</span>`
        : "";
      const completeUrl = `${ORIGIN}/baby/milestones/${r.key}/complete`;
      const window = `Day ${r.age_window_low_days}-${r.age_window_high_days}`;
      const sourceAnchor = `<a href="${r.source_url}" style="color:#1d4ed8;text-decoration:none">source</a>`;
      const description = r.clinical_note
        ? `<div style="font-size:13px;color:#4b5563;margin:0 0 10px;line-height:1.5">${escapeHtml(r.clinical_note)}</div>`
        : "";
      return `
    <li style="margin:0 0 18px;padding:0;list-style:none">
      <div style="font-weight:600;color:#111827;line-height:1.35">${escapeHtml(r.display_name)}${pastBadge}</div>
      <div style="font-size:12px;color:#6b7280;margin:3px 0 8px">${window} &middot; ${sourceAnchor}</div>
      ${description}
      <a href="${completeUrl}" style="display:inline-block;padding:7px 14px;background:#1d4ed8;color:#ffffff;text-decoration:none;border-radius:6px;font-size:13px;font-weight:500">Mark complete</a>
    </li>`;
    })
    .join("");

  return `${MILESTONE_HTML_MARKER}
<div style="max-width:620px;margin:20px auto 0;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:24px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1f2937;line-height:1.55">
  <h2 style="margin:0 0 6px;font-size:14px;text-transform:uppercase;letter-spacing:0.05em;color:#111827">${MILESTONE_HEADER}</h2>
  <p style="margin:0 0 18px;color:#4b5563;font-size:13px">Tap to mark any of these complete when you've seen them. <a href="${ORIGIN}/baby/milestones" style="color:#1d4ed8">Manage all milestones</a>.</p>
  <ul style="margin:0;padding:0">${items}
  </ul>
</div>
${MILESTONE_HTML_END}`;
}

function renderText(rows: CatalogRow[], ageInDays: number): string {
  if (rows.length === 0) return "";
  const lines: string[] = [];
  lines.push(MILESTONE_HEADER);
  lines.push(
    `Tap any link to mark it complete. View or change others at ${ORIGIN}/baby/milestones`
  );
  lines.push("");
  for (const r of rows) {
    const past = ageInDays > r.age_window_high_days;
    lines.push(`- ${r.display_name}`);
    lines.push(
      `  AAP window: day ${r.age_window_low_days}-${r.age_window_high_days}` +
        (past ? " (past expected window)" : "")
    );
    if (r.clinical_note) {
      lines.push(`  What to look for: ${r.clinical_note}`);
    }
    lines.push(`  Source: ${r.source_url}`);
    lines.push(`  Mark complete: ${ORIGIN}/baby/milestones/${r.key}/complete`);
    lines.push("");
  }
  return lines.join("\n");
}

/** Strip a previously-injected section so re-runs are idempotent. */
function stripPreviousHtml(html: string): string {
  return html.replace(
    new RegExp(
      `${MILESTONE_HTML_MARKER}[\\s\\S]*?${MILESTONE_HTML_END}\\s*`,
      "g"
    ),
    ""
  );
}

function stripPreviousText(text: string): string {
  const idx = text.indexOf(MILESTONE_HEADER);
  if (idx < 0) return text;
  return text.slice(0, idx).trimEnd();
}

async function loadExcludeKeys(): Promise<Set<string>> {
  const argv = process.argv.slice(2);
  const keys = new Set<string>();

  const inline = argv.find((a) => a.startsWith("--exclude="))?.split("=")[1];
  if (inline) {
    for (const k of inline.split(",")) {
      const key = k.trim();
      if (key) keys.add(key);
    }
  }

  const fileArg = argv
    .find((a) => a.startsWith("--exclude-file="))
    ?.split("=")[1];
  if (fileArg) {
    const raw = await fs.readFile(resolve(process.cwd(), fileArg), "utf8");
    const parsed = JSON.parse(raw) as string[] | { excludeKeys?: string[] };
    const arr = Array.isArray(parsed) ? parsed : parsed.excludeKeys ?? [];
    for (const k of arr) {
      const key = String(k).trim();
      if (key) keys.add(key);
    }
  }

  return keys;
}

async function main() {
  const daysArg = process.argv
    .slice(2)
    .find((a) => a.startsWith("--days="))
    ?.split("=")[1];
  const days = parseDayArg(daysArg);

  const excludeKeys = await loadExcludeKeys();
  if (excludeKeys.size > 0) {
    console.log(
      `Excluding ${excludeKeys.size} completed/skipped milestone(s): ${[...excludeKeys].join(", ")}`
    );
  }

  const catalogJson = JSON.parse(
    await fs.readFile(resolve(process.cwd(), CATALOG_FILE), "utf8")
  ) as CatalogJson;
  const catalog = catalogJson.milestones;
  console.log(
    `Catalog v${catalogJson.version} (${catalog.length} entries) at ${CATALOG_FILE}`
  );

  // Decide which artifacts to process.
  const artifactDir = resolve(process.cwd(), ARTIFACT_DIR);
  const entries = await fs.readdir(artifactDir);
  const allDays = entries
    .map((f) => /^day-(\d+)\.json$/.exec(f))
    .filter((m): m is RegExpExecArray => !!m)
    .map((m) => Number(m[1]))
    .sort((a, b) => a - b);
  const targetDays =
    days === "all" ? allDays : allDays.filter((d) => days.includes(d));
  if (targetDays.length === 0) {
    console.error(`No matching day-N.json artifacts found.`);
    process.exit(1);
  }

  console.log(`Processing days: ${targetDays.join(", ")}\n`);

  for (const day of targetDays) {
    const filePath = resolve(artifactDir, `day-${day}.json`);
    const artifact = JSON.parse(
      await fs.readFile(filePath, "utf8")
    ) as Artifact;

    const rows = surfaceable(catalog, day, excludeKeys);
    const milestoneHtml = renderHtml(rows, day);
    const milestoneText = renderText(rows, day);

    let bodyHtml = stripPreviousHtml(artifact.bodyHtml);
    let bodyText = stripPreviousText(artifact.bodyText);

    if (rows.length > 0) {
      bodyHtml = /<\/body>/i.test(bodyHtml)
        ? bodyHtml.replace(/<\/body>/i, `${milestoneHtml}</body>`)
        : `${bodyHtml}\n${milestoneHtml}`;
      bodyText = `${bodyText.trimEnd()}\n\n${milestoneText}`.trimEnd() + "\n";
    }

    const next: Artifact = {
      ...artifact,
      bodyHtml,
      bodyText,
    };

    await fs.writeFile(filePath, JSON.stringify(next, null, 2) + "\n", "utf8");

    console.log(
      `day-${day}.json: ${rows.length} milestone(s) → ${rows.map((r) => r.key).join(", ") || "(none — pre-window)"}`
    );
  }

  console.log(`\nDone. Run \`npm run precompute:validate\` to confirm.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
