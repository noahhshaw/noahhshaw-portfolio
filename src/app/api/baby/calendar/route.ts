import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { calendarEvents } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { getCurrentParent } from "@/lib/baby/session";

export const runtime = "nodejs";

// Calendar events: birthdays, holidays, vaccine appointments, school deadlines.
// `source='aap'` rows are seeded from baby-kb/calendars/*.json — those should
// not be edited via UI.

export async function GET() {
  const parent = await getCurrentParent();
  if (!parent) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rows = await db
    .select()
    .from(calendarEvents)
    .orderBy(asc(calendarEvents.eventDate));
  return NextResponse.json({ events: rows });
}

type NewEventBody = {
  eventDate: string;
  eventType: string;
  title: string;
  description?: string;
  recurrence?: "none" | "yearly";
};

export async function POST(request: NextRequest) {
  const parent = await getCurrentParent();
  if (!parent) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: NewEventBody;
  try {
    body = (await request.json()) as NewEventBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (!body.eventDate || !body.eventType || !body.title) {
    return NextResponse.json(
      { error: "eventDate, eventType, title required" },
      { status: 400 }
    );
  }

  const inserted = await db
    .insert(calendarEvents)
    .values({
      eventDate: body.eventDate,
      eventType: body.eventType,
      title: body.title,
      description: body.description ?? null,
      recurrence: body.recurrence ?? "none",
      source: "parent",
    })
    .returning();
  return NextResponse.json({ event: inserted[0] });
}

export async function DELETE(request: NextRequest) {
  const parent = await getCurrentParent();
  if (!parent) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const id = Number(request.nextUrl.searchParams.get("id"));
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  // Don't let UI delete AAP-seeded rows.
  const existing = await db
    .select()
    .from(calendarEvents)
    .where(eq(calendarEvents.id, id))
    .limit(1);
  if (!existing[0]) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (existing[0].source === "aap") {
    return NextResponse.json(
      { error: "cannot delete AAP-seeded event" },
      { status: 403 }
    );
  }

  await db.delete(calendarEvents).where(eq(calendarEvents.id, id));
  return NextResponse.json({ ok: true });
}
