import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { shortList, names } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const coupleId = parseInt(searchParams.get("coupleId") || "", 10);

  if (isNaN(coupleId)) {
    return NextResponse.json(
      { error: "coupleId is required" },
      { status: 400 }
    );
  }

  const entries = await db
    .select({
      nameId: shortList.nameId,
      name: names.name,
      user1Rating: shortList.user1Rating,
      user2Rating: shortList.user2Rating,
      addedAt: shortList.addedAt,
    })
    .from(shortList)
    .innerJoin(names, eq(shortList.nameId, names.id))
    .where(eq(shortList.coupleId, coupleId))
    .orderBy(desc(shortList.addedAt));

  return NextResponse.json({ shortList: entries });
}
