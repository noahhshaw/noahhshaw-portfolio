import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ratings, names } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { RECENT_RATINGS_LIMIT } from "@/app/projects/baby-name-rater/lib/constants";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = parseInt(searchParams.get("userId") || "", 10);
  const limit = parseInt(
    searchParams.get("limit") || String(RECENT_RATINGS_LIMIT),
    10
  );

  if (isNaN(userId)) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const recentRatings = await db
    .select({
      nameId: ratings.nameId,
      name: names.name,
      rating: ratings.rating,
      updatedAt: ratings.updatedAt,
    })
    .from(ratings)
    .innerJoin(names, eq(ratings.nameId, names.id))
    .where(eq(ratings.userId, userId))
    .orderBy(desc(ratings.updatedAt))
    .limit(limit);

  return NextResponse.json({ ratings: recentRatings });
}
