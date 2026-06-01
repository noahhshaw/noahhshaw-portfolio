import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { names } from "@/db/schema";
import { sql } from "drizzle-orm";
import { babyNames } from "@/data/babyNames";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// One-shot recovery endpoint to (re)seed the baby-name-rater `names` table.
// Touches ONLY the `names` table — no effect on any other feature or table.
//
// Auth: requires `Authorization: Bearer <BABY_INTERNAL_SECRET>`.
// Idempotent: upserts by `name_lower` (unique), so re-running updates content
// rather than creating duplicates.
//
// GET returns the current row count (read-only) for verification.

async function countNames(): Promise<number> {
  const rows = await db.select({ c: sql<number>`count(*)::int` }).from(names);
  return rows[0]?.c ?? 0;
}

export async function GET() {
  return NextResponse.json({ count: await countNames() });
}

export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const secret = process.env.BABY_INTERNAL_SECRET;
  const bearerOk =
    !!secret && secret.length > 0 && auth === `Bearer ${secret}`;

  if (!bearerOk) {
    return NextResponse.json(
      { error: "unauthorized: Authorization: Bearer BABY_INTERNAL_SECRET required" },
      { status: 401 }
    );
  }

  // Build rows; dedupe by name_lower so a batch can't conflict with itself.
  const seen = new Set<string>();
  const rows: (typeof names.$inferInsert)[] = [];
  for (const e of babyNames) {
    const trimmed = (e.name ?? "").trim();
    if (!trimmed) continue;
    const nameLower = trimmed.toLowerCase();
    if (seen.has(nameLower)) continue;
    seen.add(nameLower);
    rows.push({
      name: trimmed,
      nameLower,
      origin: e.origin ?? null,
      meaning: e.meaning ?? null,
      usRank: e.usRank ?? 0,
      worldRank: e.worldRank ?? 0,
      famousPerson1: e.famousPerson1 ?? null,
      famousPerson2: e.famousPerson2 ?? null,
      famousPerson3: e.famousPerson3 ?? null,
      alternativeSpellings: e.alternativeSpellings ?? [],
      isBoy: !!e.isBoy,
      isGirl: !!e.isGirl,
      phonetic: e.phonetic ?? null,
      startingLetter: trimmed[0].toUpperCase(),
      syllableCount: e.syllableCount ?? null,
      meaningTags: e.meaningTags ?? [],
    });
  }

  // Overwrite-on-conflict (refresh content), batched so thousands of names
  // load in a handful of round-trips instead of one INSERT per name.
  const updateSet = {
    name: sql`excluded."name"`,
    origin: sql`excluded."origin"`,
    meaning: sql`excluded."meaning"`,
    usRank: sql`excluded."us_rank"`,
    worldRank: sql`excluded."world_rank"`,
    famousPerson1: sql`excluded."famous_person_1"`,
    famousPerson2: sql`excluded."famous_person_2"`,
    famousPerson3: sql`excluded."famous_person_3"`,
    alternativeSpellings: sql`excluded."alternative_spellings"`,
    isBoy: sql`excluded."is_boy"`,
    isGirl: sql`excluded."is_girl"`,
    phonetic: sql`excluded."phonetic"`,
    startingLetter: sql`excluded."starting_letter"`,
    syllableCount: sql`excluded."syllable_count"`,
    meaningTags: sql`excluded."meaning_tags"`,
  };

  const BATCH = 500;
  let upserts = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    await db
      .insert(names)
      .values(batch)
      .onConflictDoUpdate({ target: names.nameLower, set: updateSet });
    upserts += batch.length;
  }

  return NextResponse.json({ ok: true, seeded: upserts, total: await countNames() });
}
