import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { precomputedEmails, calendarEvents } from "@/db/schema";
import { eq, gte, or } from "drizzle-orm";
import { getCurrentParent } from "@/lib/baby/session";
import { eventsInWindow } from "@/lib/baby/recurrence";
import { applyOverlay } from "@/lib/baby/upcoming-overlay";

export const runtime = "nodejs";

// Returns the full body of a pre-computed email, with a `withOverlay` field
// that shows what would actually go out if sent today.

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
    .from(precomputedEmails)
    .where(eq(precomputedEmails.id, id))
    .limit(1);
  if (!rows[0]) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // Build the calendar overlay against today's calendar state.
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setFullYear(cutoff.getFullYear() - 1);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const all = await db
    .select()
    .from(calendarEvents)
    .where(
      or(
        eq(calendarEvents.recurrence, "yearly"),
        gte(calendarEvents.eventDate, cutoffStr)
      )
    );
  const upcoming = eventsInWindow(all, now, 14).map((e) => ({
    effectiveDate: e.effectiveDate,
    title: e.title,
  }));

  const overlaid = applyOverlay(
    { html: rows[0].bodyHtml, text: rows[0].bodyText },
    upcoming
  );

  return NextResponse.json({
    row: rows[0],
    overlay: { html: overlaid.html, text: overlaid.text, upcoming },
  });
}
