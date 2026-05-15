import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import { resolve } from "path";
import { db } from "@/db";
import {
  babyProfile,
  milestoneEvents,
  milestonesCatalog,
  type NewMilestoneCatalog,
} from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export const runtime = "nodejs";
export const maxDuration = 60;

// One-shot admin endpoint to apply the milestones schema migration (0001)
// and seed the catalog without needing DATABASE_URL outside Vercel.
//
// Idempotent end-to-end:
//   - Creates milestones_catalog / milestone_events tables only if missing.
//   - Upserts catalog rows by `key`.
//   - Lazy-creates pending event rows for every (baby, milestone) pair.
//
// Auth: Bearer BABY_INTERNAL_SECRET.
//
// Usage:
//   SECRET=$(grep '^BABY_INTERNAL_SECRET=' .env.local | cut -d= -f2- | tr -d '"')
//   curl -s -X POST "https://www.noahhshaw.com/api/baby/admin/migrate-and-seed-milestones" \
//     -H "Authorization: Bearer $SECRET" | jq

const CATALOG_FILE = "baby-kb/milestones/aap-cdc-2022.json";

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

const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS "milestones_catalog" (
  "id" serial PRIMARY KEY NOT NULL,
  "key" text NOT NULL UNIQUE,
  "display_name" text NOT NULL,
  "category" text NOT NULL,
  "age_window_low_days" integer NOT NULL,
  "age_window_high_days" integer NOT NULL,
  "source_url" text NOT NULL,
  "clinical_note" text,
  "seed_order" integer NOT NULL,
  "catalog_version" text NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "milestones_catalog_window_valid" CHECK ("age_window_low_days" <= "age_window_high_days")
);

CREATE INDEX IF NOT EXISTS "milestones_catalog_seed_order_idx" ON "milestones_catalog" USING btree ("seed_order");
CREATE INDEX IF NOT EXISTS "milestones_catalog_window_idx" ON "milestones_catalog" USING btree ("age_window_low_days");

CREATE TABLE IF NOT EXISTS "milestone_events" (
  "id" serial PRIMARY KEY NOT NULL,
  "baby_profile_id" integer NOT NULL REFERENCES "baby_profile"("id") ON DELETE CASCADE,
  "milestone_id" integer NOT NULL REFERENCES "milestones_catalog"("id") ON DELETE CASCADE,
  "status" text DEFAULT 'pending' NOT NULL,
  "observed_date" date,
  "completed_at" timestamp with time zone,
  "skipped_at" timestamp with time zone,
  "notes" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "milestone_events_baby_milestone_unique" UNIQUE("baby_profile_id","milestone_id"),
  CONSTRAINT "milestone_events_status_valid" CHECK ("status" IN ('pending', 'complete', 'skipped'))
);

CREATE INDEX IF NOT EXISTS "milestone_events_status_idx" ON "milestone_events" USING btree ("status");
`;

export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const internalSecret = process.env.BABY_INTERNAL_SECRET;
  if (!internalSecret || auth !== `Bearer ${internalSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const out: Record<string, unknown> = {};

  // 1. Apply migration (idempotent — uses IF NOT EXISTS throughout).
  // db.execute with raw sql supports multiple statements via semicolons.
  // We split on `;\n\n` and run each chunk separately so a single bad
  // statement doesn't poison the rest of the batch.
  const stmts = MIGRATION_SQL.split(/;\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const migrationResults: Array<{ stmt: string; ok: boolean; error?: string }> = [];
  for (const s of stmts) {
    try {
      await db.execute(sql.raw(s));
      migrationResults.push({ stmt: s.slice(0, 60), ok: true });
    } catch (err) {
      migrationResults.push({
        stmt: s.slice(0, 60),
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  out.migration = migrationResults;

  // 2. Seed catalog (upsert by key).
  const catalogPath = resolve(process.cwd(), CATALOG_FILE);
  let catalogJson: CatalogJson;
  try {
    catalogJson = JSON.parse(readFileSync(catalogPath, "utf8")) as CatalogJson;
  } catch (err) {
    return NextResponse.json(
      {
        error: `failed to read catalog at ${CATALOG_FILE}`,
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }

  let upserts = 0;
  for (const m of catalogJson.milestones) {
    const row: NewMilestoneCatalog = {
      key: m.key,
      displayName: m.display_name,
      category: m.category,
      ageWindowLowDays: m.age_window_low_days,
      ageWindowHighDays: m.age_window_high_days,
      sourceUrl: m.source_url,
      clinicalNote: m.clinical_note ?? null,
      seedOrder: m.seed_order,
      catalogVersion: catalogJson.version,
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
  out.catalogVersion = catalogJson.version;
  out.catalogUpserts = upserts;

  // 3. Lazy-create pending events for every (baby × milestone).
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
  out.babiesProcessed = babies.length;
  out.pendingEventsCreated = pendingCreated;
  out.catalogRowsTotal = cats.length;

  return NextResponse.json({ ok: true, ...out });
}
