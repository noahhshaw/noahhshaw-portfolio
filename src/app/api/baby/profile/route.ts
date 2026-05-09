import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { babyProfile } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentParent } from "@/lib/baby/session";

export const runtime = "nodejs";

// GET — fetch the singleton baby_profile row.
export async function GET() {
  const parent = await getCurrentParent();
  if (!parent) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rows = await db.select().from(babyProfile).limit(1);
  return NextResponse.json({ profile: rows[0] ?? null });
}

type ProfileUpdate = {
  dueDate?: string;
  birthDate?: string | null;
  babyName?: string | null;
  pediatricianName?: string | null;
  pediatricianPhone?: string | null;
  meta?: Record<string, unknown>;
};

// PUT — upsert the singleton baby_profile row.
export async function PUT(request: NextRequest) {
  const parent = await getCurrentParent();
  if (!parent) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: ProfileUpdate;
  try {
    body = (await request.json()) as ProfileUpdate;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const existing = await db.select().from(babyProfile).limit(1);
  const row = existing[0];

  const patch = {
    dueDate: body.dueDate ?? row?.dueDate ?? "",
    birthDate: body.birthDate === undefined ? row?.birthDate ?? null : body.birthDate,
    babyName: body.babyName === undefined ? row?.babyName ?? null : body.babyName,
    pediatricianName:
      body.pediatricianName === undefined
        ? row?.pediatricianName ?? null
        : body.pediatricianName,
    pediatricianPhone:
      body.pediatricianPhone === undefined
        ? row?.pediatricianPhone ?? null
        : body.pediatricianPhone,
    meta: body.meta ?? row?.meta ?? {},
    updatedAt: new Date(),
  };

  if (!patch.dueDate) {
    return NextResponse.json(
      { error: "due_date is required for the initial profile" },
      { status: 400 }
    );
  }

  if (row) {
    const updated = await db
      .update(babyProfile)
      .set(patch)
      .where(eq(babyProfile.id, row.id))
      .returning();
    return NextResponse.json({ profile: updated[0] });
  }
  const inserted = await db.insert(babyProfile).values(patch).returning();
  return NextResponse.json({ profile: inserted[0] });
}
