import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, couples } from "@/db/schema";
import { eq, or } from "drizzle-orm";

export async function POST(request: NextRequest) {
  const { userId, partnerEmail } = await request.json();

  if (!userId || !partnerEmail) {
    return NextResponse.json(
      { error: "userId and partnerEmail are required" },
      { status: 400 }
    );
  }

  const normalizedPartnerEmail = partnerEmail.toLowerCase().trim();

  // Get the creating user
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Prevent pairing with self
  if (user.email === normalizedPartnerEmail) {
    return NextResponse.json(
      { error: "Cannot pair with yourself" },
      { status: 400 }
    );
  }

  // Check if user already belongs to a couple — remove old pairing
  const existingCouples = await db
    .select()
    .from(couples)
    .where(or(eq(couples.user1Id, userId), eq(couples.user2Id, userId)));

  for (const existing of existingCouples) {
    await db.delete(couples).where(eq(couples.id, existing.id));
  }

  // Find or create partner user
  let [partner] = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizedPartnerEmail));

  if (!partner) {
    [partner] = await db
      .insert(users)
      .values({ email: normalizedPartnerEmail })
      .returning();
  }

  // Check if partner already created a couple with this user
  const [partnerCouple] = await db
    .select()
    .from(couples)
    .where(eq(couples.user1Id, partner.id));

  if (partnerCouple && partnerCouple.user2Id === null) {
    // Partner created a couple waiting for someone — join it
    const [updated] = await db
      .update(couples)
      .set({ user2Id: userId })
      .where(eq(couples.id, partnerCouple.id))
      .returning();

    return NextResponse.json({ couple: updated });
  }

  // Create new couple
  const [couple] = await db
    .insert(couples)
    .values({
      user1Id: userId,
      user2Id: partner.id,
    })
    .returning();

  return NextResponse.json({ couple });
}
