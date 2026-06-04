/* eslint-disable no-console */
/**
 * Run content + link validation against every JSON file in
 * baby-kb/precomputed/ (or a specific subset).
 *
 *   npx tsx scripts/validate-precomputed.ts            # all
 *   npx tsx scripts/validate-precomputed.ts 0 7 14     # specific days
 *
 * Completed / skipped milestones:
 *   By default the milestone-presence check treats any catalog row whose
 *   window has opened (low_days <= ageInDays) as "expected". When the
 *   parent has marked rows complete/skipped, those days may legitimately
 *   have an empty check-in (no pending row in-window). Pass the same
 *   exclude set you baked with so the presence check matches reality:
 *
 *     npx tsx scripts/validate-precomputed.ts --exclude=brief-head-lift,... 25 26 27
 *     npx tsx scripts/validate-precomputed.ts --exclude-file=completed.json
 *
 * Exits 0 if every file passes, 1 otherwise. No network/API except link probes.
 */
import { readdirSync, readFileSync } from "fs";
import path from "path";
import { validateEmail, checkLinks } from "@/lib/baby/validators";

const DIR = path.join(process.cwd(), "baby-kb", "precomputed");
const CATALOG_FILE = path.join(
  process.cwd(),
  "baby-kb",
  "milestones",
  "aap-cdc-2022.json"
);

type Artifact = {
  ageInDays: number;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  citations: string[];
};

type CatalogJson = {
  milestones: Array<{ age_window_low_days: number; key: string }>;
};

/** Parse --exclude=a,b and --exclude-file=path into a key set. */
function loadExcludeKeys(argv: string[]): Set<string> {
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
    const parsed = JSON.parse(
      readFileSync(path.resolve(process.cwd(), fileArg), "utf8")
    ) as string[] | { excludeKeys?: string[] };
    const arr = Array.isArray(parsed) ? parsed : parsed.excludeKeys ?? [];
    for (const k of arr) {
      const key = String(k).trim();
      if (key) keys.add(key);
    }
  }
  return keys;
}

/**
 * Pure file-side eligibility check — matches the rule in
 * loadSurfaceableMilestones (catalog row whose low_days <= ageInDays).
 * Does NOT consider per-baby completion state because (a) this script
 * runs without DB access and (b) emails are baked from the catalog's
 * pending-default view; state-aware re-baking is a separate flow.
 */
function loadMilestonesExpectedFn(
  excludeKeys: Set<string>
): (ageInDays: number) => boolean {
  let catalog: CatalogJson["milestones"] = [];
  try {
    const raw = readFileSync(CATALOG_FILE, "utf8");
    catalog = (JSON.parse(raw) as CatalogJson).milestones ?? [];
  } catch (err) {
    console.warn(
      `[validate] could not read catalog at ${CATALOG_FILE} (${
        err instanceof Error ? err.message : err
      }) — milestone-presence check disabled for this run`
    );
    return () => undefined as unknown as boolean;
  }
  // A day "expects" a check-in only if at least one in-window milestone is
  // still pending — i.e. eligible by age AND not in the parent's
  // completed/skipped exclude set. This mirrors loadSurfaceableMilestones.
  return (ageInDays: number) =>
    catalog.some(
      (m) => m.age_window_low_days <= ageInDays && !excludeKeys.has(m.key)
    );
}

function selectFiles(argv: string[]): string[] {
  const wanted = argv.slice(2).map((s) => Number(s.trim())).filter((n) => Number.isFinite(n));
  const all = readdirSync(DIR).filter((f) => /^day-(-?\d+)\.json$/.test(f));
  if (wanted.length === 0) return all.map((f) => path.join(DIR, f));
  const out: string[] = [];
  for (const n of wanted) {
    const f = path.join(DIR, `day-${n}.json`);
    out.push(f);
  }
  return out;
}

async function main() {
  const files = selectFiles(process.argv);
  const excludeKeys = loadExcludeKeys(process.argv.slice(2));
  if (excludeKeys.size > 0) {
    console.log(
      `Treating ${excludeKeys.size} milestone(s) as complete/skipped: ${[...excludeKeys].join(", ")}\n`
    );
  }
  const milestonesExpectedAt = loadMilestonesExpectedFn(excludeKeys);
  let failed = 0;
  let total = 0;

  for (const file of files) {
    total += 1;
    const name = path.basename(file);
    let artifact: Artifact;
    try {
      artifact = JSON.parse(readFileSync(file, "utf8")) as Artifact;
    } catch (err) {
      console.error(`${name}: cannot parse JSON — ${err instanceof Error ? err.message : err}`);
      failed += 1;
      continue;
    }

    const milestonesExpected = milestonesExpectedAt(artifact.ageInDays);
    const contentIssues = validateEmail({
      ...artifact,
      milestonesExpected,
    });
    const linkResults = await checkLinks(artifact, { timeoutMs: 10000 });
    const linkIssues = linkResults
      .filter((r) => !r.ok)
      .map((r) => `${r.url} → ${r.status ? `HTTP ${r.status}` : r.error}`);

    const ok = contentIssues.length === 0 && linkIssues.length === 0;
    if (ok) {
      console.log(`${name}: ✓ clean (${linkResults.length} links probed, all 2xx)`);
    } else {
      failed += 1;
      console.log(`${name}: ✗ ${contentIssues.length} content + ${linkIssues.length} link issues`);
      for (const i of contentIssues) console.log(`  - ${i}`);
      for (const i of linkIssues) console.log(`  - link: ${i}`);
    }
  }

  console.log(`\n${total - failed}/${total} passed.`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
