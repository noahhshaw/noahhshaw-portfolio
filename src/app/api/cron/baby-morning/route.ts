import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  dailyEmails,
  agentSettings,
  precomputedEmails,
  calendarEvents,
} from "@/db/schema";
import { eq, gte, or } from "drizzle-orm";
import { loadAgeContext } from "@/lib/baby/age";
import { renderFallback, loadProfile } from "@/lib/baby/render-fallback";
import { sendDaily } from "@/lib/baby/send";
import { eventsInWindow } from "@/lib/baby/recurrence";
import { applyOverlay } from "@/lib/baby/upcoming-overlay";

export const runtime = "nodejs";

// Daily 7am Pacific cron. Resolution order:
//   1. If a daily_emails row already exists for today (status=sent),
//      exit silently.
//   2. If `paused_until` is in the future, exit.
//   3. Look up precomputed_emails for today's ageInDays with status='approved'.
//      If found, apply the calendar overlay (next 14 days) and send.
//   4. Otherwise, render the template fallback and send.

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    const tokenParam = request.nextUrl.searchParams.get("token");
    const provided = auth?.replace("Bearer ", "") || tokenParam;
    if (provided !== cronSecret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const force = request.nextUrl.searchParams.get("force") === "1";
  const todayKey = isoDateInPacific(new Date());

  if (!force) {
    const existing = await db
      .select({ id: dailyEmails.id, status: dailyEmails.status })
      .from(dailyEmails)
      .where(eq(dailyEmails.sentDate, todayKey))
      .limit(1);
    if (existing[0] && existing[0].status === "sent") {
      return NextResponse.json({
        skipped: true,
        reason: "already-sent-today",
        dailyEmailId: existing[0].id,
      });
    }

    const paused = await db
      .select({ value: agentSettings.value })
      .from(agentSettings)
      .where(eq(agentSettings.key, "paused_until"))
      .limit(1);
    const pausedUntilRaw = paused[0]?.value as string | null | undefined;
    if (pausedUntilRaw && typeof pausedUntilRaw === "string") {
      const pausedUntil = new Date(pausedUntilRaw);
      if (Number.isFinite(pausedUntil.getTime()) && pausedUntil > new Date()) {
        return NextResponse.json({
          skipped: true,
          reason: "paused-until",
          pausedUntil: pausedUntilRaw,
        });
      }
    }
  }

  const profile = await loadProfile();
  if (!profile) {
    return NextResponse.json(
      { error: "baby_profile not configured", todayKey },
      { status: 500 }
    );
  }

  const age = await loadAgeContext();
  if (!age) {
    return NextResponse.json(
      { error: "could not load age context" },
      { status: 500 }
    );
  }

  // Try precomputed first.
  const precomputed = await db
    .select()
    .from(precomputedEmails)
    .where(eq(precomputedEmails.ageInDays, age.ageInDays))
    .limit(1);

  let sourcePath: "precomputed" | "cron-fallback";
  let render: Awaited<ReturnType<typeof renderFallback>>;

  if (precomputed[0] && precomputed[0].status === "approved") {
    const upcoming = await loadUpcomingForOverlay();
    const overlaid = applyOverlay(
      {
        html: precomputed[0].bodyHtml,
        text: precomputed[0].bodyText,
      },
      upcoming
    );
    render = {
      subject: precomputed[0].subject,
      html: overlaid.html,
      text: overlaid.text,
      citations: precomputed[0].citations,
    };
    sourcePath = "precomputed";
  } else {
    render = await renderFallback(age, profile);
    sourcePath = "cron-fallback";
  }

  const result = await sendDaily({
    render,
    ageInDays: age.ageInDays,
    sentDate: todayKey,
    sourcePath,
  });

  // Mark the precomputed row as sent if we used it.
  if (sourcePath === "precomputed" && precomputed[0] && !result.error) {
    await db
      .update(precomputedEmails)
      .set({ status: "sent", sentAt: new Date() })
      .where(eq(precomputedEmails.id, precomputed[0].id));
  }

  return NextResponse.json({
    ok: !result.error,
    error: result.error,
    messageId: result.messageId,
    dailyEmailId: result.dailyEmail?.id,
    sentDate: todayKey,
    ageInDays: age.ageInDays,
    source: sourcePath,
    precomputedStatus: precomputed[0]?.status ?? null,
  });
}

async function loadUpcomingForOverlay() {
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
  return eventsInWindow(all, now, 14).map((e) => ({
    effectiveDate: e.effectiveDate,
    title: e.title,
  }));
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
