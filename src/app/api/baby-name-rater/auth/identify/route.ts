import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, couples } from "@/db/schema";
import { eq, or } from "drizzle-orm";

export async function POST(request: NextRequest) {
  const { email } = await request.json();

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Find or create user
  let [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail));

  if (!user) {
    [user] = await db
      .insert(users)
      .values({ email: normalizedEmail })
      .returning();
  }

  // Check if user belongs to a couple
  const [couple] = await db
    .select()
    .from(couples)
    .where(or(eq(couples.user1Id, user.id), eq(couples.user2Id, user.id)));

  const response = NextResponse.json({
    user: { id: user.id, email: user.email },
    couple: couple || null,
  });

  // Set userId cookie for session persistence
  response.cookies.set("userId", String(user.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });

  return response;
}
