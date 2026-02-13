import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ratings, shortList } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = parseInt(searchParams.get("userId") || "", 10);
  const coupleId = parseInt(searchParams.get("coupleId") || "", 10);

  if (isNaN(userId) || isNaN(coupleId)) {
    return NextResponse.json(
      { error: "userId and coupleId are required" },
      { status: 400 }
    );
  }

  const [ratingCount, shortListResult] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(ratings)
      .where(eq(ratings.userId, userId)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(shortList)
      .where(eq(shortList.coupleId, coupleId)),
  ]);

  return NextResponse.json({
    totalRatings: ratingCount[0]?.count ?? 0,
    shortListCount: shortListResult[0]?.count ?? 0,
  });
}
