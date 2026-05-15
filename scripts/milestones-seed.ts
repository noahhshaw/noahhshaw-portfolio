/* eslint-disable no-console */
/**
 * Idempotent seed for the milestones catalog. Reads
 * baby-kb/milestones/aap-cdc-2022.json (or whatever CATALOG_FILE points
 * to) and UPSERTs each row by `key`. Also ensures every existing baby
 * profile has a pending event row per catalog entry.
 *
 * Run:
 *   vercel env pull .env.local --environment=production
 *   npm run milestones:seed
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
  type NewMilestoneCatalog,
} from "@/db/schema";
import { eq, sql } from "drizzle-orm";

const CATALOG_FILE =
  process.env.CATALOG_FILE ?? "baby-kb/milestones/aap-cdc-2022.json";

type CatalogJson = {
  version: string;
  source: string;
  notes?: string;
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

async function main() {
  const raw = readFileSync(resolve(process.cwd(), CATALOG_FILE), "utf8");
  const cat = JSON.parse(raw) as CatalogJson;
  console.log(
    `Catalog version ${cat.version} with ${cat.milestones.length} milestones`
  );

  let upserts = 0;
  for (const m of cat.milestones) {
    const row: NewMilestoneCatalog = {
      key: m.key,
      displayName: m.display_name,
      category: m.category,
      ageWindowLowDays: m.age_window_low_days,
      ageWindowHighDays: m.age_window_high_days,
      sourceUrl: m.source_url,
      clinicalNote: m.clinical_note ?? null,
      seedOrder: m.seed_order,
      catalogVersion: cat.version,
    };
    await db
      .insert(milestonesCatalog)
      .values(row)
      .onConflictDoUpdate({
        target: milestonesCatalog.key,
        set: {
          displayName: row.displayName,
          category: row.category,
          ageWindowLowDays: row.ageWindowLowDays,
          ageWindowHighDays: row.ageWindowHighDays,
          sourceUrl: row.sourceUrl,
          clinicalNote: row.clinicalNote,
          seedOrder: row.seedOrder,
          catalogVersion: row.catalogVersion,
          updatedAt: sql`now()`,
        },
      });
    upserts += 1;
  }
  console.log(`Upserted ${upserts} catalog rows.`);

  // Create pending events for any (baby, milestone) pairs not yet seen.
  const babies = await db.select({ id: babyProfile.id }).from(babyProfile);
  const cats = await db
    .select({ id: milestonesCatalog.id })
    .from(milestonesCatalog);
  let pendingCreated = 0;
  for (const b of babies) {
    const existing = await db
      .select({ id: milestoneEvents.milestoneId })
      .from(milestoneEvents)
      .where(eq(milestoneEvents.babyProfileId, b.id));
    const have = new Set(existing.map((e) => e.id));
    const toInsert = cats
      .filter((c) => !have.has(c.id))
      .map((c) => ({
        babyProfileId: b.id,
        milestoneId: c.id,
        status: "pending" as const,
      }));
    if (toInsert.length > 0) {
      await db.insert(milestoneEvents).values(toInsert);
      pendingCreated += toInsert.length;
    }
  }
  console.log(
    `Created ${pendingCreated} pending event rows across ${babies.length} baby profile(s).`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
