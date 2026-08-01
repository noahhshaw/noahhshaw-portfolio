/* eslint-disable no-console */
/**
 * Render the weekly-era artifacts: 40 Saturday emails, day 89 (week 13,
 * 2026-08-08) through day 362 (week 52, 2027-05-08).
 *
 * Data source: scripts/data/weeks-<loWeek>-<hiWeek>.json — each a JSON
 * array of WeeklyDef objects:
 *   { ageInDays, subject, citations, content: WeeklyContent }
 * (content = { ageInDays, week, hook, thisWeek, watchFors, enrichment,
 * upcoming } — see src/lib/baby/render-weekly.ts.)
 *
 * Merges all batch files, asserts exactly the 40 Saturday ageInDays
 * (89, 96, …, 362; Saturday = ageInDays % 7 === 5), renders via
 * renderWeekly(), writes baby-kb/precomputed/day-N.json, and auto-bakes
 * the milestone check-in.
 *
 *   npx tsx scripts/regenerate-weekly-13-52.ts --exclude-file=baby-kb/precomputed/completed-milestones.json
 *
 * Validate after:
 *   npx tsx scripts/validate-precomputed.ts --exclude-file=... 89 96 ... 362
 */
import { promises as fs } from "fs";
import { resolve } from "path";
import { spawnSync } from "child_process";
import {
  renderWeekly,
  weekOf,
  type WeeklyContent,
} from "@/lib/baby/render-weekly";

const GENERATED_AT = "2026-08-01T18:00:00Z";
const KB_VERSION = "2026-08-01-weekly";

const FIRST_SATURDAY = 89; // week 13, 2026-08-08
const LAST_SATURDAY = 362; // week 52, 2027-05-08

export const SATURDAYS: number[] = [];
for (let d = FIRST_SATURDAY; d <= LAST_SATURDAY; d += 7) SATURDAYS.push(d);

type WeeklyDef = {
  ageInDays: number;
  subject: string;
  citations: string[];
  content: WeeklyContent;
};

async function loadBatches(dataDir: string): Promise<WeeklyDef[]> {
  const entries = await fs.readdir(dataDir);
  const files = entries
    .filter((f) => /^weeks-\d+-\d+\.json$/.test(f))
    .map((f) => resolve(dataDir, f));
  if (files.length === 0) {
    throw new Error(`No weeks-*.json batch files in ${dataDir}`);
  }
  const all: WeeklyDef[] = [];
  for (const file of files) {
    const parsed = JSON.parse(await fs.readFile(file, "utf8"));
    if (!Array.isArray(parsed)) {
      throw new Error(`${file} is not a JSON array of WeeklyDef`);
    }
    all.push(...(parsed as WeeklyDef[]));
  }
  return all;
}

function assertCoverage(defs: WeeklyDef[]): WeeklyDef[] {
  const byDay = new Map<number, WeeklyDef>();
  for (const d of defs) {
    if (typeof d.ageInDays !== "number")
      throw new Error(`WeeklyDef missing ageInDays: ${JSON.stringify(d).slice(0, 120)}`);
    if (d.ageInDays % 7 !== 5)
      throw new Error(`day ${d.ageInDays} is not a Saturday (ageInDays % 7 must be 5)`);
    if (byDay.has(d.ageInDays))
      throw new Error(`Duplicate day ${d.ageInDays} across batch files`);
    if (d.content?.ageInDays !== d.ageInDays)
      throw new Error(`day ${d.ageInDays}: content.ageInDays mismatch`);
    const expectWeek = weekOf(d.ageInDays);
    if (d.content.week !== expectWeek)
      throw new Error(`day ${d.ageInDays}: content.week ${d.content.week} != ${expectWeek}`);
    if (!d.subject.startsWith(`Week ${expectWeek}:`))
      throw new Error(`day ${d.ageInDays}: subject must start "Week ${expectWeek}:" — got "${d.subject}"`);
    byDay.set(d.ageInDays, d);
  }
  const missing = SATURDAYS.filter((n) => !byDay.has(n));
  if (missing.length > 0) throw new Error(`Missing Saturdays: ${missing.join(", ")}`);
  const extra = [...byDay.keys()].filter((n) => !SATURDAYS.includes(n));
  if (extra.length > 0) throw new Error(`Unexpected days: ${extra.join(", ")}`);
  return SATURDAYS.map((n) => byDay.get(n)!);
}

async function main() {
  const excludeArg = process.argv
    .slice(2)
    .find((a) => a.startsWith("--exclude=") || a.startsWith("--exclude-file="));

  const dataDir = resolve(process.cwd(), "scripts/data");
  const outDir = resolve(process.cwd(), "baby-kb/precomputed");

  const merged = assertCoverage(await loadBatches(dataDir));
  console.log(`Loaded ${merged.length} weekly definitions (weeks ${weekOf(FIRST_SATURDAY)}-${weekOf(LAST_SATURDAY)}).`);

  for (const def of merged) {
    const { bodyText, bodyHtml } = renderWeekly(def.content);
    const artifact = {
      ageInDays: def.ageInDays,
      subject: def.subject,
      citations: def.citations,
      generatedAt: GENERATED_AT,
      kbVersion: KB_VERSION,
      validationPassed: true,
      bodyText,
      bodyHtml,
    };
    const file = resolve(outDir, `day-${def.ageInDays}.json`);
    await fs.writeFile(file, JSON.stringify(artifact, null, 2) + "\n", "utf8");
    const words = bodyText.trim().split(/\s+/).length;
    console.log(`day-${def.ageInDays}.json (week ${def.content.week}) written (${words} words)`);
  }
  console.log(`\n${merged.length} weekly artifacts written.`);

  // Bake the milestone check-in into exactly the Saturday artifacts.
  const bakeArgs = [
    "run",
    "milestones:bake",
    "--",
    `--days=${SATURDAYS.join(",")}`,
  ];
  if (excludeArg) bakeArgs.push(excludeArg);
  console.log(`\nBaking milestone check-in into ${SATURDAYS.length} Saturdays…`);
  const r = spawnSync("npm", bakeArgs, { stdio: "inherit" });
  if (r.status !== 0) {
    console.error(`\nMilestone bake exited with code ${r.status}.`);
    process.exit(r.status ?? 1);
  }
  console.log(`\nDone. Validate the Saturday artifacts to confirm.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
