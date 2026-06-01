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

  let upserts = 0;
  for (const e of babyNames) {
    const trimmed = (e.name ?? "").trim();
    if (!trimmed) continue;
    const row = {
      name: trimmed,
      nameLower: trimmed.toLowerCase(),
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
    };
    await db
      .insert(names)
      .values(row)
      .onConflictDoUpdate({
        target: names.nameLower,
        set: {
          name: row.name,
          origin: row.origin,
          meaning: row.meaning,
          usRank: row.usRank,
          worldRank: row.worldRank,
          famousPerson1: row.famousPerson1,
          famousPerson2: row.famousPerson2,
          famousPerson3: row.famousPerson3,
          alternativeSpellings: row.alternativeSpellings,
          isBoy: row.isBoy,
          isGirl: row.isGirl,
          phonetic: row.phonetic,
          startingLetter: row.startingLetter,
          syllableCount: row.syllableCount,
          meaningTags: row.meaningTags,
        },
      });
    upserts += 1;
  }

  return NextResponse.json({ ok: true, seeded: upserts, total: await countNames() });
}
