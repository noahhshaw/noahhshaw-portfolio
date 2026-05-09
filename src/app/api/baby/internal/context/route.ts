import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  babyProfile,
  parentContext,
  calendarEvents,
  dailyEmails,
  agentSettings,
} from "@/db/schema";
import { gte, desc, eq, or } from "drizzle-orm";
import { loadAgeContext } from "@/lib/baby/age";
import { BABY_PARENT_EMAILS } from "@/lib/baby/constants";
import { checkInternalAuth } from "@/lib/baby/internal-auth";
import { eventsInWindow } from "@/lib/baby/recurrence";

export const runtime = "nodejs";

// GET /api/baby/internal/context
// Used by the Claude routine to load all state needed to draft today's email.

export async function GET(request: NextRequest) {
  const denied = checkInternalAuth(request);
  if (denied) return denied;

  const profileRows = await db.select().from(babyProfile).limit(1);
  const profile = profileRows[0] ?? null;
  if (!profile) {
    return NextResponse.json(
      { error: "baby_profile not seeded" },
      { status: 500 }
    );
  }

  const age = await loadAgeContext();
  if (!age) {
    return NextResponse.json(
      { error: "could not compute age context" },
      { status: 500 }
    );
  }

  const todayKey = isoDateInPacific(new Date());
  const sentTodayRows = await db
    .select({ id: dailyEmails.id, status: dailyEmails.status })
    .from(dailyEmails)
    .where(eq(dailyEmails.sentDate, todayKey))
    .limit(1);
  const alreadySentToday =
    sentTodayRows[0]?.status === "sent";

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentContext = await db
    .select()
    .from(parentContext)
    .where(gte(parentContext.createdAt, sevenDaysAgo))
    .orderBy(desc(parentContext.createdAt))
    .limit(20);

  const yearAgo = new Date();
  yearAgo.setFullYear(yearAgo.getFullYear() - 1);
  const yearAgoStr = yearAgo.toISOString().slice(0, 10);
  const allEvents = await db
    .select()
    .from(calendarEvents)
    .where(
      or(
        eq(calendarEvents.recurrence, "yearly"),
        gte(calendarEvents.eventDate, yearAgoStr)
      )
    );
  const upcomingEvents = eventsInWindow(allEvents, new Date(), 14);

  const settings = await db.select().from(agentSettings);
  const settingsMap: Record<string, unknown> = {};
  for (const s of settings) settingsMap[s.key] = s.value;

  return NextResponse.json({
    profile: {
      dueDate: profile.dueDate,
      birthDate: profile.birthDate,
      babyName: profile.babyName,
      pediatricianName: profile.pediatricianName,
      pediatricianPhone: profile.pediatricianPhone,
      meta: profile.meta,
    },
    age,
    todayKey,
    alreadySentToday,
    recipients: BABY_PARENT_EMAILS,
    recentContext,
    upcomingEvents,
    settings: settingsMap,
  });
}

function isoDateInPacific(now: Date): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(now);
}
