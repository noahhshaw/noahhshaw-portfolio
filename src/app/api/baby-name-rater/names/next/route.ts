import { NextRequest, NextResponse } from "next/server";
import { getNextName } from "@/app/projects/baby-name-rater/lib/ranker";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = parseInt(searchParams.get("userId") || "", 10);
  const coupleId = parseInt(searchParams.get("coupleId") || "", 10);
  const excludeNameId = searchParams.get("excludeNameId")
    ? parseInt(searchParams.get("excludeNameId")!, 10)
    : undefined;

  if (isNaN(userId) || isNaN(coupleId)) {
    return NextResponse.json(
      { error: "userId and coupleId are required" },
      { status: 400 }
    );
  }

  const name = await getNextName(userId, coupleId, excludeNameId);

  if (!name) {
    return NextResponse.json({
      name: null,
      exhausted: true,
      message: "You have rated all available names!",
    });
  }

  return NextResponse.json({ name, exhausted: false });
}
