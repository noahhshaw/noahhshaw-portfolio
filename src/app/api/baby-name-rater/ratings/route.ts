import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ratings, shortList, couples, names } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { SHORT_LIST_THRESHOLD } from "@/app/projects/baby-name-rater/lib/constants";

export async function POST(request: NextRequest) {
  const { userId, nameId, coupleId, rating } = await request.json();

  if (!userId || !nameId || !coupleId || !rating) {
    return NextResponse.json(
      { error: "userId, nameId, coupleId, and rating are required" },
      { status: 400 }
    );
  }

  if (rating < 1 || rating > 5) {
    return NextResponse.json(
      { error: "Rating must be between 1 and 5" },
      { status: 400 }
    );
  }

  const now = new Date();

  // UPSERT rating
  await db
    .insert(ratings)
    .values({
      userId,
      nameId,
      coupleId,
      rating,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [ratings.userId, ratings.nameId],
      set: { rating, updatedAt: now },
    });

  // Get the couple to determine partner
  const [couple] = await db
    .select()
    .from(couples)
    .where(eq(couples.id, coupleId));

  if (!couple) {
    return NextResponse.json({ error: "Couple not found" }, { status: 404 });
  }

  const partnerId =
    couple.user1Id === userId ? couple.user2Id : couple.user1Id;

  // Check partner's rating for this name
  let shortListChange: "added" | "removed" | null = null;

  if (partnerId) {
    const [partnerRating] = await db
      .select()
      .from(ratings)
      .where(
        and(
          eq(ratings.userId, partnerId),
          eq(ratings.nameId, nameId)
        )
      );

    const bothHighEnough =
      partnerRating &&
      partnerRating.rating >= SHORT_LIST_THRESHOLD &&
      rating >= SHORT_LIST_THRESHOLD;

    if (bothHighEnough) {
      // Determine which rating belongs to user1 vs user2
      const isUser1 = couple.user1Id === userId;
      const user1Rating = isUser1 ? rating : partnerRating.rating;
      const user2Rating = isUser1 ? partnerRating.rating : rating;

      await db
        .insert(shortList)
        .values({
          coupleId,
          nameId,
          user1Rating,
          user2Rating,
          addedAt: now,
        })
        .onConflictDoUpdate({
          target: [shortList.coupleId, shortList.nameId],
          set: { user1Rating, user2Rating, addedAt: now },
        });
      shortListChange = "added";
    } else {
      // Remove from short list if it exists
      const deleted = await db
        .delete(shortList)
        .where(
          and(
            eq(shortList.coupleId, coupleId),
            eq(shortList.nameId, nameId)
          )
        )
        .returning();

      if (deleted.length > 0) {
        shortListChange = "removed";
      }
    }
  }

  // Get the name data for the response (for sidebar update)
  const [nameData] = await db
    .select({ name: names.name })
    .from(names)
    .where(eq(names.id, nameId));

  return NextResponse.json({
    rating: { userId, nameId, coupleId, rating, updatedAt: now.toISOString() },
    shortListChange,
    name: nameData?.name || null,
  });
}
