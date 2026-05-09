import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { dailyEmails } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentParent } from "@/lib/baby/session";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const parent = await getCurrentParent();
  if (!parent) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const rows = await db
    .select()
    .from(dailyEmails)
    .where(eq(dailyEmails.id, id))
    .limit(1);
  if (!rows[0]) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ email: rows[0] });
}
