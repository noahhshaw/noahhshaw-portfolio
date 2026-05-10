/* eslint-disable no-console */
/**
 * Pre-compute the daily emails for the first year and store them as drafts.
 *
 * Usage:
 *   DATABASE_URL=$NEON_URL ANTHROPIC_API_KEY=$KEY \
 *     npx tsx scripts/precompute-emails.ts --days=0-30 [--force]
 *
 * --days        range "a-b" or comma list "0,7,14,28". Default: -7 to 30.
 * --force       regenerate even if a row with status != 'rejected' exists.
 *
 * The script:
 *   1. For each ageInDays in range, loads voice.md + week-NN.md + a few topic
 *      excerpts, calls Sonnet 4.6, validates the output, upserts into
 *      precomputed_emails as 'draft' (or 'rejected' if validation fails hard).
 *   2. Prints a summary at the end (counts, total cost, validation issues).
 */
import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// --- env loading ---
function loadEnvLocal() {
  if (process.env.DATABASE_URL && process.env.ANTHROPIC_API_KEY) return;
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  const content = readFileSync(path, "utf8");
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!value) continue;
    if (!(key in process.env) || !process.env[key]) {
      process.env[key] = value;
    }
  }
}
loadEnvLocal();

import { db } from "@/db";
import { precomputedEmails } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  generateEmailAI,
  loadVoiceGuideFromDisk,
  loadBucketFromDisk,
  loadTopicFromDisk,
} from "@/lib/baby/render-ai";
import { validateEmail } from "@/lib/baby/validators";

type Args = {
  days: number[];
  force: boolean;
};

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  let daysSpec = "-7-30";
  let force = false;
  for (const a of argv) {
    if (a.startsWith("--days=")) daysSpec = a.slice("--days=".length);
    else if (a === "--force") force = true;
  }
  return { days: parseDaysSpec(daysSpec), force };
}

function parseDaysSpec(spec: string): number[] {
  if (spec.includes(",")) {
    return spec
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n));
  }
  // range: support negatives like "-7-30"
  // Match "<signed-int>-<signed-int>"
  const m = spec.match(/^(-?\d+)-(-?\d+)$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a > b) throw new Error(`invalid range: ${spec}`);
    const out: number[] = [];
    for (let i = a; i <= b; i++) out.push(i);
    return out;
  }
  const single = Number(spec);
  if (Number.isFinite(single)) return [single];
  throw new Error(`could not parse --days: ${spec}`);
}

function gitSha(): string | null {
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return null;
  }
}

function weekIndexForAge(ageInDays: number): number {
  if (ageInDays < 0) return 1;
  return Math.floor(ageInDays / 7) + 1;
}

// Crude topic-relevance heuristic: pick 1–2 topics by week.
function topicsForWeek(weekIndex: number): string[] {
  if (weekIndex <= 2) {
    return [
      "sleep-newborn-fundamentals.md",
      "breastfeeding-vs-formula-vs-combo.md",
    ];
  }
  if (weekIndex <= 8) {
    return ["fever-by-age.md", "tummy-time-and-motor.md"];
  }
  if (weekIndex <= 16) {
    return ["sleep-4-month-regression.md", "language-exposure.md"];
  }
  if (weekIndex <= 26) {
    return ["introducing-solids.md", "naps-by-age.md"];
  }
  if (weekIndex <= 40) {
    return ["nutrition-year-one.md", "common-illnesses-year-one.md"];
  }
  return ["first-birthday-planning.md", "weaning-from-breast-or-bottle.md"];
}

async function main() {
  const args = parseArgs();
  const sha = gitSha();
  console.log(`precompute-emails: ${args.days.length} days, kbVersion=${sha ?? "(no-git)"}, force=${args.force}`);

  const voice = await loadVoiceGuideFromDisk();

  let totalCost = 0;
  const summary: Array<{
    ageInDays: number;
    status: string;
    issues: string[];
    cost: string;
  }> = [];

  for (const ageInDays of args.days) {
    const weekIndex = weekIndexForAge(ageInDays);

    if (!args.force) {
      const existing = await db
        .select()
        .from(precomputedEmails)
        .where(eq(precomputedEmails.ageInDays, ageInDays))
        .limit(1);
      if (existing[0] && existing[0].status !== "rejected") {
        console.log(`day ${ageInDays}: skip (status=${existing[0].status})`);
        summary.push({
          ageInDays,
          status: `skip-${existing[0].status}`,
          issues: [],
          cost: "0",
        });
        continue;
      }
    }

    let bucketContent: string;
    try {
      bucketContent = await loadBucketFromDisk(weekIndex);
    } catch (err) {
      console.error(`day ${ageInDays}: bucket week-${weekIndex} not found`, err);
      summary.push({
        ageInDays,
        status: "error-no-bucket",
        issues: [`bucket week-${weekIndex} missing`],
        cost: "0",
      });
      continue;
    }

    const topicFiles = topicsForWeek(weekIndex);
    const topicExcerpts: { path: string; content: string }[] = [];
    for (const tf of topicFiles) {
      try {
        const content = await loadTopicFromDisk(tf);
        topicExcerpts.push({ path: `baby-kb/topics/${tf}`, content });
      } catch {
        // optional
      }
    }

    let result;
    try {
      result = await generateEmailAI({
        ageInDays,
        weekIndex,
        voiceGuide: voice,
        bucketContent,
        topicExcerpts,
        calendarHints: [], // age-static calendar hints can be added later
      });
    } catch (err) {
      console.error(`day ${ageInDays}: render failed`, err);
      summary.push({
        ageInDays,
        status: "error-render",
        issues: [err instanceof Error ? err.message : String(err)],
        cost: "0",
      });
      continue;
    }

    const issues = validateEmail({
      ageInDays,
      subject: result.subject,
      bodyText: result.bodyText,
      bodyHtml: result.bodyHtml,
      citations: result.citations,
    });

    await db
      .insert(precomputedEmails)
      .values({
        ageInDays,
        weekIndex,
        subject: result.subject,
        bodyHtml: result.bodyHtml,
        bodyText: result.bodyText,
        citations: result.citations,
        kbVersion: sha,
        modelUsed: "claude-sonnet-4-6",
        tokensUsed:
          result.inputTokens +
          result.outputTokens +
          result.cacheReadTokens +
          result.cacheCreationTokens,
        costUsd: result.costUsd,
        status: "draft",
        validationIssues: issues,
      })
      .onConflictDoUpdate({
        target: precomputedEmails.ageInDays,
        set: {
          weekIndex,
          subject: result.subject,
          bodyHtml: result.bodyHtml,
          bodyText: result.bodyText,
          citations: result.citations,
          generatedAt: new Date(),
          kbVersion: sha,
          modelUsed: "claude-sonnet-4-6",
          tokensUsed:
            result.inputTokens +
            result.outputTokens +
            result.cacheReadTokens +
            result.cacheCreationTokens,
          costUsd: result.costUsd,
          status: "draft",
          validationIssues: issues,
          rejectionReason: null,
          reviewedAt: null,
          reviewedByEmail: null,
        },
      });

    totalCost += Number(result.costUsd);
    console.log(
      `day ${ageInDays}: draft (${issues.length} issues) cost=$${result.costUsd}`
    );
    summary.push({
      ageInDays,
      status: "draft",
      issues,
      cost: result.costUsd,
    });
  }

  console.log("\n=== Summary ===");
  console.log(`days processed: ${summary.length}`);
  console.log(`total cost: $${totalCost.toFixed(4)}`);
  const drafts = summary.filter((s) => s.status === "draft");
  const errors = summary.filter((s) => s.status.startsWith("error"));
  const skipped = summary.filter((s) => s.status.startsWith("skip"));
  console.log(`new drafts: ${drafts.length}`);
  console.log(`skipped: ${skipped.length}`);
  console.log(`errors: ${errors.length}`);
  const cleanDrafts = drafts.filter((s) => s.issues.length === 0).length;
  const flagged = drafts.length - cleanDrafts;
  console.log(`drafts with no validation issues: ${cleanDrafts}`);
  console.log(`drafts with validation issues: ${flagged}`);
  if (flagged > 0) {
    console.log("\nFlagged days (review on dashboard):");
    for (const s of drafts.filter((d) => d.issues.length > 0)) {
      console.log(`  day ${s.ageInDays}: ${s.issues.join("; ")}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
