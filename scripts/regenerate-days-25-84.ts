/* eslint-disable no-console */
/**
 * Render days 25-84 (60 daily artifacts) from the verified content batches
 * produced by the `baby-newsletter-days-25-84` workflow.
 *
 * Data source: scripts/data/days-<lo>-<hi>.json — each file is a JSON array
 * of DayDef objects ({ ageInDays, subject, citations, content }). The
 * workflow's adversarial verify stage writes them; this script merges,
 * checks contiguous coverage of days 25-84, renders each via the shared
 * renderDaily(), writes baby-kb/precomputed/day-N.json, and auto-bakes the
 * milestone check-in.
 *
 * Forward completed/skipped milestone keys to the bake step so the parents
 * stop seeing items they already marked:
 *
 *   npx tsx scripts/regenerate-days-25-84.ts --exclude-file=baby-kb/precomputed/completed-milestones.json
 *
 * Then confirm with:
 *   npx tsx scripts/validate-precomputed.ts --exclude-file=baby-kb/precomputed/completed-milestones.json <days...>
 */
import { promises as fs } from "fs";
import { resolve } from "path";
import { spawnSync } from "child_process";
import { renderDaily, type DailyContent } from "@/lib/baby/render-daily";

const GENERATED_AT = "2026-06-04T18:00:00Z";
const KB_VERSION = "2026-06-04-60day";
const LO = 25;
const HI = 84;

type DayDef = {
  ageInDays: number;
  subject: string;
  citations: string[];
  content: DailyContent;
};

async function loadBatches(dataDir: string): Promise<DayDef[]> {
  const entries = await fs.readdir(dataDir);
  const files = entries
    .filter((f) => /^days-\d+-\d+\.json$/.test(f))
    .map((f) => resolve(dataDir, f));
  if (files.length === 0) {
    throw new Error(`No days-*.json batch files in ${dataDir}`);
  }
  const all: DayDef[] = [];
  for (const file of files) {
    const parsed = JSON.parse(await fs.readFile(file, "utf8"));
    if (!Array.isArray(parsed)) {
      throw new Error(`${file} is not a JSON array of DayDef`);
    }
    all.push(...(parsed as DayDef[]));
  }
  return all;
}

function assertCoverage(days: DayDef[]): DayDef[] {
  const byDay = new Map<number, DayDef>();
  for (const d of days) {
    if (typeof d.ageInDays !== "number")
      throw new Error(`DayDef missing ageInDays: ${JSON.stringify(d).slice(0, 120)}`);
    if (byDay.has(d.ageInDays))
      throw new Error(`Duplicate day ${d.ageInDays} across batch files`);
    if (d.content?.ageInDays !== d.ageInDays)
      throw new Error(`day ${d.ageInDays}: content.ageInDays mismatch (${d.content?.ageInDays})`);
    byDay.set(d.ageInDays, d);
  }
  const missing: number[] = [];
  for (let n = LO; n <= HI; n++) if (!byDay.has(n)) missing.push(n);
  if (missing.length > 0)
    throw new Error(`Missing days: ${missing.join(", ")}`);
  const extra = [...byDay.keys()].filter((n) => n < LO || n > HI);
  if (extra.length > 0)
    throw new Error(`Unexpected days outside ${LO}-${HI}: ${extra.join(", ")}`);
  return Array.from(byDay.values()).sort((a, b) => a.ageInDays - b.ageInDays);
}

async function main() {
  const excludeArg = process.argv
    .slice(2)
    .find((a) => a.startsWith("--exclude=") || a.startsWith("--exclude-file="));

  const dataDir = resolve(process.cwd(), "scripts/data");
  const outDir = resolve(process.cwd(), "baby-kb/precomputed");

  const merged = assertCoverage(await loadBatches(dataDir));
  console.log(`Loaded ${merged.length} day definitions (${LO}-${HI}).`);

  for (const day of merged) {
    const { bodyText, bodyHtml } = renderDaily(day.content);
    const artifact = {
      ageInDays: day.ageInDays,
      subject: day.subject,
      citations: day.citations,
      generatedAt: GENERATED_AT,
      kbVersion: KB_VERSION,
      validationPassed: true,
      bodyText,
      bodyHtml,
    };
    const file = resolve(outDir, `day-${day.ageInDays}.json`);
    await fs.writeFile(file, JSON.stringify(artifact, null, 2) + "\n", "utf8");
    const words = bodyText.trim().split(/\s+/).length;
    console.log(`day-${day.ageInDays}.json written (${words} words)`);
  }
  console.log(`\n${merged.length} artifacts written.`);

  const bakeArgs = ["run", "milestones:bake", "--", `--days=${LO}-${HI}`];
  if (excludeArg) bakeArgs.push(excludeArg);
  console.log(
    `\nBaking milestone check-in into days ${LO}-${HI}` +
      (excludeArg ? ` (${excludeArg})` : "") +
      "…"
  );
  const r = spawnSync("npm", bakeArgs, { stdio: "inherit" });
  if (r.status !== 0) {
    console.error(`\nMilestone bake exited with code ${r.status}.`);
    process.exit(r.status ?? 1);
  }
  console.log(`\nDone. Run precompute:validate to confirm.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
