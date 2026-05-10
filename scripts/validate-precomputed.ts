/* eslint-disable no-console */
/**
 * Run content + link validation against every JSON file in
 * baby-kb/precomputed/ (or a specific subset).
 *
 *   npx tsx scripts/validate-precomputed.ts            # all
 *   npx tsx scripts/validate-precomputed.ts 0 7 14     # specific days
 *
 * Exits 0 if every file passes, 1 otherwise. No network/API except link probes.
 */
import { readdirSync, readFileSync } from "fs";
import path from "path";
import { validateEmail, checkLinks } from "@/lib/baby/validators";

const DIR = path.join(process.cwd(), "baby-kb", "precomputed");

type Artifact = {
  ageInDays: number;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  citations: string[];
};

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

    const contentIssues = validateEmail(artifact);
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
