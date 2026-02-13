import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { couples, users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: { coupleId: string } }
) {
  const coupleId = parseInt(params.coupleId, 10);
  if (isNaN(coupleId)) {
    return NextResponse.json({ error: "Invalid couple ID" }, { status: 400 });
  }

  const [couple] = await db
    .select()
    .from(couples)
    .where(eq(couples.id, coupleId));

  if (!couple) {
    return NextResponse.json({ error: "Couple not found" }, { status: 404 });
  }

  const [user1] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, couple.user1Id));

  const [user2] = couple.user2Id
    ? await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, couple.user2Id))
    : [null];

  return NextResponse.json({
    couple: {
      id: couple.id,
      genderFilter: couple.genderFilter,
      firstLetterFilter: couple.firstLetterFilter,
      user1: { id: couple.user1Id, email: user1?.email },
      user2: couple.user2Id
        ? { id: couple.user2Id, email: user2?.email }
        : null,
    },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { coupleId: string } }
) {
  const coupleId = parseInt(params.coupleId, 10);
  if (isNaN(coupleId)) {
    return NextResponse.json({ error: "Invalid couple ID" }, { status: 400 });
  }

  const body = await request.json();
  const updates: Record<string, string> = {};

  if (body.genderFilter !== undefined) {
    if (!["boy", "girl", "all"].includes(body.genderFilter)) {
      return NextResponse.json(
        { error: "genderFilter must be 'boy', 'girl', or 'all'" },
        { status: 400 }
      );
    }
    updates.genderFilter = body.genderFilter;
  }

  if (body.firstLetterFilter !== undefined) {
    const valid = body.firstLetterFilter === "all" ||
      (/^[A-Z]$/.test(body.firstLetterFilter));
    if (!valid) {
      return NextResponse.json(
        { error: "firstLetterFilter must be 'all' or a single A-Z letter" },
        { status: 400 }
      );
    }
    updates.firstLetterFilter = body.firstLetterFilter;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 }
    );
  }

  const [updated] = await db
    .update(couples)
    .set(updates)
    .where(eq(couples.id, coupleId))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Couple not found" }, { status: 404 });
  }

  return NextResponse.json({ couple: updated });
}
