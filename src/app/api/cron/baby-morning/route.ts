import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { dailyEmails, agentSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { loadAgeContext } from "@/lib/baby/age";
import { renderFallback, loadProfile } from "@/lib/baby/render-fallback";
import { sendDaily } from "@/lib/baby/send";

export const runtime = "nodejs";

// Daily 7am Pacific cron. The Claude routine is the primary daily render path;
// this cron exists as a guaranteed fallback. If the routine has already
// recorded a `daily_emails` row for today, this cron exits without sending.
//
// Two cron entries handle PST/PDT in vercel.json:
//   `0 14 * * *` — 6am PST / 7am PDT
//   `0 15 * * *` — 7am PST / 8am PDT
// One of those will be 7am-local; the other 8am-local. We send if no row
// exists yet for today, so both can fire safely on either side of DST.

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

    // Honor the paused_until setting (set via /baby config page).
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

  const render = await renderFallback(age, profile);
  const result = await sendDaily({
    render,
    ageInDays: age.ageInDays,
    sentDate: todayKey,
    sourcePath: "cron-fallback",
  });

  return NextResponse.json({
    ok: !result.error,
    error: result.error,
    messageId: result.messageId,
    dailyEmailId: result.dailyEmail?.id,
    sentDate: todayKey,
    ageInDays: age.ageInDays,
  });
}

function isoDateInPacific(now: Date): string {
  // Get the YYYY-MM-DD label for "today" in America/Los_Angeles, since the
  // cron fires in UTC but our schedule is local-time.
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(now);
}
