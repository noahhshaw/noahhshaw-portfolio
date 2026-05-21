#!/usr/bin/env node
/**
 * a11y-check runner: navigate to one or more paths on the local dev server,
 * inject axe-core, run an audit, and print violations focused on color-contrast.
 *
 * Usage:
 *   node .claude/skills/a11y-check/scripts/run.mjs [path-or-url...]
 *   node .claude/skills/a11y-check/scripts/run.mjs /sky --click 'button[aria-expanded]'
 *
 * Env:
 *   BASE_URL  default http://localhost:3000
 *   REPORT    default /tmp/a11y-report.json
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { execSync } from "node:child_process";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const REPORT = process.env.REPORT || "/tmp/a11y-report.json";
const DEFAULT_PATHS = ["/sky"];

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "../../../..");

// Parse args: paths + --click <selector>
const args = process.argv.slice(2);
const paths = [];
const clicks = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--click" && args[i + 1]) {
    clicks.push(args[++i]);
  } else {
    paths.push(args[i]);
  }
}
const targets = (paths.length ? paths : DEFAULT_PATHS).map((p) =>
  p.startsWith("http") ? p : `${BASE_URL}${p.startsWith("/") ? "" : "/"}${p}`
);

// Locate playwright + axe-core
function resolveModule(name) {
  try {
    return import.meta.resolve
      ? new URL(import.meta.resolve(name)).pathname
      : require.resolve(name);
  } catch {
    return null;
  }
}

async function ensurePlaywright() {
  // Try local install first, then known global location. Playwright's CJS
  // entry comes through under .default when loaded via ESM dynamic import.
  for (const src of ["playwright", "/opt/node22/lib/node_modules/playwright/index.js"]) {
    try {
      const m = await import(src);
      if (m.chromium) return m;
      if (m.default && m.default.chromium) return m.default;
    } catch {}
  }
  console.error(
    "playwright not found. Install with: npm install -D playwright && npx playwright install chromium"
  );
  process.exit(2);
}

function ensureAxe() {
  const local = resolve(projectRoot, "node_modules/axe-core/axe.min.js");
  if (existsSync(local)) return readFileSync(local, "utf8");
  console.error("axe-core not installed; installing as devDep…");
  execSync("npm install -D axe-core --silent", {
    cwd: projectRoot,
    stdio: "inherit",
  });
  return readFileSync(local, "utf8");
}

function pickExecutablePath() {
  // Prefer existing system chromium to avoid re-download.
  for (const p of [
    "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    "/opt/google/chrome/chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
  ]) {
    if (existsSync(p)) return p;
  }
  return undefined;
}

const { chromium } = await ensurePlaywright();
const axeSource = ensureAxe();
const executablePath = pickExecutablePath();

const browser = await chromium.launch({ executablePath });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });

const allViolations = [];
for (const url of targets) {
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
  } catch (e) {
    console.error(`failed to load ${url}: ${e.message}`);
    await page.close();
    continue;
  }
  for (const sel of clicks) {
    try {
      await page.click(sel, { timeout: 2000 });
      await page.waitForTimeout(300);
    } catch {
      console.error(`could not click ${sel} on ${url}`);
    }
  }
  await page.addScriptTag({ content: axeSource });
  const result = await page.evaluate(async () => {
    // @ts-ignore
    return await window.axe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"],
      },
      resultTypes: ["violations"],
    });
  });
  for (const v of result.violations) {
    allViolations.push({ url, ...v });
  }
  await page.close();
}
await browser.close();

writeFileSync(REPORT, JSON.stringify(allViolations, null, 2));

const SEV = { minor: 1, moderate: 2, serious: 3, critical: 4 };
allViolations.sort((a, b) => (SEV[b.impact] || 0) - (SEV[a.impact] || 0));

if (allViolations.length === 0) {
  console.log(`✓ no a11y violations across ${targets.length} target(s)`);
  process.exit(0);
}

console.log(`Found ${allViolations.length} violation type(s):\n`);
for (const v of allViolations) {
  const head = `[${v.impact}] ${v.id} (${v.nodes.length} node${v.nodes.length > 1 ? "s" : ""}) ${v.url}`;
  console.log(head);
  console.log(`  ${v.help}`);
  for (const n of v.nodes.slice(0, 5)) {
    const sel = (n.target || []).join(" ");
    const summary = (n.failureSummary || "").replace(/\s+/g, " ").slice(0, 200);
    console.log(`  - ${sel}`);
    if (summary) console.log(`      ${summary}`);
  }
  if (v.nodes.length > 5) console.log(`  …and ${v.nodes.length - 5} more`);
  console.log("");
}
console.log(`Full report: ${REPORT}`);

const hasSerious = allViolations.some(
  (v) => v.impact === "serious" || v.impact === "critical"
);
process.exit(hasSerious ? 1 : 0);
