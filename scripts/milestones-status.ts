/* eslint-disable no-console */
/**
 * Print current per-baby milestone state — used by the gen pipeline
 * (Claude Code session) when writing a day's pre-computed JSON. The agent
 * reads this to decide what to include in the "Developmental milestone
 * check-in" section.
 *
 * Default behavior: print every surface-eligible milestone for today's
 * ageInDays (computed from baby_profile.birth_date), capped at 5.
 *
 * Flags:
 *   --age-days=N     override age (useful when authoring future days ahead)
 *   --from=N --to=N  print every catalog entry whose low_days is in [from,to]
 *                    (useful for batch-generating a range)
 *   --limit=N        cap (default 5; 0 = uncapped)
 *   --json           emit JSON instead of pretty text
 *   --all            ignore status filter; show every catalog row
 *
 * Run:
 *   npm run milestones:status
 *   npm run milestones:status -- --age-days=22 --limit=5
 *   npm run milestones:status -- --from=22 --to=35 --json
 */
import { readFileSync } from "fs";
import { resolve } from "path";

const ENV = ".env.local";
try {
  const envText = readFileSync(resolve(process.cwd(), ENV), "utf8");
  for (const line of envText.split("\n")) {
    const m = /^([A-Z_][A-Z0-9_]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|(.*))$/.exec(line.trim());
    if (!m) continue;
    const key = m[1];
    const val = m[2] ?? m[3] ?? m[4] ?? "";
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  console.warn(`(no ${ENV} found; relying on existing env)`);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

import { db } from "@/db";
import {
  babyProfile,
  milestoneEvents,
  milestonesCatalog,
} from "@/db/schema";
import { and, asc, eq, gte, lte } from "drizzle-orm";

type Args = {
  ageDays: number | null;
  from: number | null;
  to: number | null;
  limit: number;
  json: boolean;
  all: boolean;
};

function parseArgs(): Args {
  const out: Args = {
    ageDays: null,
    from: null,
    to: null,
    limit: 5,
    json: false,
    all: false,
  };
  for (const arg of process.argv.slice(2)) {
    if (arg === "--json") out.json = true;
    else if (arg === "--all") out.all = true;
    else if (arg.startsWith("--age-days=")) out.ageDays = Number(arg.split("=")[1]);
    else if (arg.startsWith("--from=")) out.from = Number(arg.split("=")[1]);
    else if (arg.startsWith("--to=")) out.to = Number(arg.split("=")[1]);
    else if (arg.startsWith("--limit=")) out.limit = Number(arg.split("=")[1]);
  }
  return out;
}

async function main() {
  const args = parseArgs();

  const babyRows = await db
    .select()
    .from(babyProfile)
    .orderBy(asc(babyProfile.id))
    .limit(1);
  if (!babyRows[0]) {
    console.error("No baby_profile row found");
    process.exit(1);
  }
  const baby = babyRows[0];

  // Resolve ageInDays. CLI override > computed from birth_date > today minus due_date.
  let ageInDays = args.ageDays;
  if (ageInDays === null) {
    const anchor = baby.birthDate ?? baby.dueDate;
    const anchorDate = new Date(anchor as string);
    const ms = Date.now() - anchorDate.getTime();
    ageInDays = Math.floor(ms / (1000 * 60 * 60 * 24));
  }

  const conditions = [eq(milestoneEvents.babyProfileId, baby.id)];
  if (!args.all) conditions.push(eq(milestoneEvents.status, "pending"));

  if (args.from !== null && args.to !== null) {
    conditions.push(gte(milestonesCatalog.ageWindowLowDays, args.from));
    conditions.push(lte(milestonesCatalog.ageWindowLowDays, args.to));
  } else {
    conditions.push(lte(milestonesCatalog.ageWindowLowDays, ageInDays));
  }

  let q = db
    .select()
    .from(milestonesCatalog)
    .innerJoin(
      milestoneEvents,
      eq(milestoneEvents.milestoneId, milestonesCatalog.id)
    )
    .where(and(...conditions))
    .orderBy(asc(milestonesCatalog.seedOrder))
    .$dynamic();

  if (args.limit > 0) q = q.limit(args.limit);

  const rows = await q;

  if (args.json) {
    process.stdout.write(
      JSON.stringify(
        {
          baby: {
            id: baby.id,
            name: baby.babyName,
            ageInDays,
            birthDate: baby.birthDate,
            dueDate: baby.dueDate,
          },
          filters: args,
          count: rows.length,
          rows: rows.map((r) => ({
            key: r.milestones_catalog.key,
            displayName: r.milestones_catalog.displayName,
            category: r.milestones_catalog.category,
            ageWindow: [
              r.milestones_catalog.ageWindowLowDays,
              r.milestones_catalog.ageWindowHighDays,
            ],
            status: r.milestone_events.status,
            observedDate: r.milestone_events.observedDate,
            notes: r.milestone_events.notes,
            sourceUrl: r.milestones_catalog.sourceUrl,
            pastWindow: ageInDays > r.milestones_catalog.ageWindowHighDays,
          })),
        },
        null,
        2
      ) + "\n"
    );
    return;
  }

  console.log(`Baby: ${baby.babyName ?? "(unnamed)"}, day ${ageInDays}`);
  console.log(
    `Filter: ${args.from !== null && args.to !== null ? `low_days in [${args.from},${args.to}]` : `low_days <= ${ageInDays}`}, status=${args.all ? "any" : "pending"}, limit=${args.limit || "none"}`
  );
  console.log(`${rows.length} milestone(s):\n`);
  for (const r of rows) {
    const past =
      ageInDays > r.milestones_catalog.ageWindowHighDays
        ? " [past window]"
        : "";
    console.log(
      `[${r.milestones_catalog.seedOrder.toString().padStart(2)}] ` +
        `${r.milestones_catalog.displayName}${past}`
    );
    console.log(
      `     window: day ${r.milestones_catalog.ageWindowLowDays}-${r.milestones_catalog.ageWindowHighDays} • category: ${r.milestones_catalog.category}`
    );
    console.log(
      `     status: ${r.milestone_events.status}` +
        (r.milestone_events.observedDate
          ? ` (observed ${r.milestone_events.observedDate})`
          : "") +
        (r.milestone_events.notes
          ? ` • notes: ${r.milestone_events.notes}`
          : "")
    );
    console.log(`     ${r.milestones_catalog.sourceUrl}`);
    console.log();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
