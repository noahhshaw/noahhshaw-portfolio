import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { Resend } from "resend";
import { db } from "@/db";
import {
  dailyEmails,
  agentSettings,
  babyProfile,
  emailReplies,
} from "@/db/schema";
import { and, eq, gte, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { loadAgeContext } from "@/lib/baby/age";
import { sendDaily } from "@/lib/baby/send";
import { BABY_FROM_EMAIL } from "@/lib/baby/constants";

export const runtime = "nodejs";

// 7am Pacific cron. Reads a pre-generated email artifact from
// baby-kb/precomputed/day-<ageInDays>.json, sends via Resend, logs.
//
// Cadence: DAILY through day 84, then WEEKLY on Saturdays only (the
// newsletter moved to a Saturday-morning weekly starting day 89 /
// 2026-08-08). The Vercel cron still fires every day; on a non-send day
// this route returns a skip instead of treating the missing artifact as
// an error. Day 0 (2026-05-11) was a Monday, so ageInDays % 7 === 5 is
// a Saturday.
//
// There is NO live AI rendering at send time and NO fallback template.
// If the artifact is missing on a genuine send day, the cron sends an
// error notice to Noah's inbox and returns 500. Re-run the pre-compute
// pipeline (in Claude Code) to fix.

const WEEKLY_START_DAY = 85; // first day of the weekly era (no daily sends >= this)

function sendExpected(ageInDays: number): boolean {
  if (ageInDays < WEEKLY_START_DAY) return true; // daily era
  return ageInDays % 7 === 5; // Saturdays only
}

type PrecomputedArtifact = {
  ageInDays: number;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  citations: string[];
  generatedAt?: string;
  kbVersion?: string;
};

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

  const profileRows = await db.select().from(babyProfile).limit(1);
  if (!profileRows[0]) {
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

  // Weekly cadence: past day 84 the newsletter goes out Saturdays only.
  // A non-send weekday is a normal skip, never a missing-artifact error.
  if (!force && !sendExpected(age.ageInDays)) {
    return NextResponse.json({
      skipped: true,
      reason: "weekly-cadence-non-send-day",
      ageInDays: age.ageInDays,
      todayKey,
    });
  }

  const artifact = await loadPrecomputed(age.ageInDays);
  if (!artifact) {
    await sendMissingArtifactNotice(age.ageInDays, todayKey);
    return NextResponse.json(
      {
        error: "no precomputed email for this age",
        ageInDays: age.ageInDays,
        todayKey,
        hint: "run the precompute pipeline in Claude Code, then commit/deploy",
      },
      { status: 500 }
    );
  }

  const result = await sendDaily({
    render: {
      subject: artifact.subject,
      html: artifact.bodyHtml,
      text: artifact.bodyText,
      citations: artifact.citations,
    },
    ageInDays: age.ageInDays,
    sentDate: todayKey,
    sourcePath: "precomputed",
  });

  // Forward-looking coverage check: warn if any upcoming SEND day lacks
  // an artifact. Daily era: next 7 days. Weekly era: the next 4 Saturdays
  // (28-day lookahead, non-send days ignored). The notice goes only to
  // Noah and only when a gap exists.
  const lookahead = age.ageInDays >= WEEKLY_START_DAY - 7 ? 28 : 7;
  const gaps = await findCoverageGaps(age.ageInDays, lookahead);
  if (gaps.length > 0) {
    await sendCoverageGapNotice(gaps, age.ageInDays);
  }

  // Reliability check: any inbound reply received >1h ago that was never
  // answered (no agent_response_message_id and not classified as
  // intentionally silent) is a quiet failure. Alert if any are found.
  const stuck = await findUnrespondedReplies();
  if (stuck.length > 0) {
    await sendUnrespondedReplyNotice(stuck);
  }

  return NextResponse.json({
    ok: !result.error,
    error: result.error,
    messageId: result.messageId,
    dailyEmailId: result.dailyEmail?.id,
    sentDate: todayKey,
    ageInDays: age.ageInDays,
    kbVersion: artifact.kbVersion ?? null,
    coverageGaps: gaps,
    unrespondedReplies: stuck.length,
  });
}

async function loadPrecomputed(
  ageInDays: number
): Promise<PrecomputedArtifact | null> {
  const file = path.join(
    process.cwd(),
    "baby-kb",
    "precomputed",
    `day-${ageInDays}.json`
  );
  try {
    const content = await fs.readFile(file, "utf8");
    return JSON.parse(content) as PrecomputedArtifact;
  } catch {
    return null;
  }
}

// Look ahead to see whether every upcoming SEND day in the window has an
// artifact. Non-send days (weekly-era weekdays) are skipped. Returns the
// list of missing ageInDays (excluding today, which is the cron's main
// job already).
async function findCoverageGaps(
  todayAge: number,
  lookaheadDays: number
): Promise<number[]> {
  const missing: number[] = [];
  for (let i = 1; i <= lookaheadDays; i++) {
    const age = todayAge + i;
    if (!sendExpected(age)) continue;
    const file = path.join(
      process.cwd(),
      "baby-kb",
      "precomputed",
      `day-${age}.json`
    );
    try {
      await fs.access(file);
    } catch {
      missing.push(age);
    }
  }
  return missing;
}

async function sendCoverageGapNotice(
  missing: number[],
  todayAge: number
): Promise<void> {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const list = missing.join(", ");
    await resend.emails.send({
      from: BABY_FROM_EMAIL,
      to: "noahhshaw@gmail.com",
      subject: `[Daily Baby] Upcoming coverage gap: ${missing.length} day(s) missing in next 7`,
      text: `Today is day ${todayAge}. The next 7 days are missing artifacts for: day ${list}.

Action needed: run the pre-compute pipeline in Claude Code for these days, commit the artifacts, and redeploy before the cron fires for each.

Today's send went out successfully. This is a forward-looking heads-up so you have time to fix it before the next miss.`,
    });
  } catch (err) {
    console.error("[baby-cron] failed to send coverage-gap notice", err);
  }
}

async function sendMissingArtifactNotice(ageInDays: number, todayKey: string) {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: BABY_FROM_EMAIL,
      to: "noahhshaw@gmail.com",
      subject: `[Daily Baby] No precomputed email for day ${ageInDays}`,
      text: `The daily cron at ${new Date().toISOString()} couldn't find baby-kb/precomputed/day-${ageInDays}.json for ${todayKey} (Pacific).

Action needed: run the pre-compute pipeline in Claude Code to generate days around ${ageInDays}, commit the artifacts, and redeploy. No daily email went out today.`,
    });
  } catch (err) {
    console.error("[baby-cron] failed to send missing-artifact notice", err);
  }
}

// "Failure" buckets for the unresponded-reply check. action_taken values
// that indicate the agent intentionally chose not to reply ('silent',
// 'stored-context', 'queued-kb-update') are excluded — they represent
// correct behavior. Everything else with no outbound message-id is suspect.
const FAILURE_ACTIONS = [
  "send-failed",
  "classify-failed",
  "classify-empty-reply",
  "send-unknown",
];

type StuckReply = {
  id: number;
  fromEmail: string;
  subject: string | null;
  receivedAt: Date;
  classification: string | null;
  actionTaken: string | null;
  processingError: string | null;
};

async function findUnrespondedReplies(): Promise<StuckReply[]> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  // 48h cap to avoid alerting on the same ancient row forever once it has
  // been seen. The first morning after a failure is when we want to know.
  const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const rows = await db
    .select({
      id: emailReplies.id,
      fromEmail: emailReplies.fromEmail,
      subject: emailReplies.subject,
      receivedAt: emailReplies.receivedAt,
      classification: emailReplies.classification,
      actionTaken: emailReplies.actionTaken,
      processingError: emailReplies.processingError,
      agentResponseMessageId: emailReplies.agentResponseMessageId,
      processedAt: emailReplies.processedAt,
    })
    .from(emailReplies)
    .where(
      and(
        lt(emailReplies.receivedAt, oneHourAgo),
        gte(emailReplies.receivedAt, twoDaysAgo),
        or(
          // Bucket A: never processed at all.
          isNull(emailReplies.processedAt),
          // Bucket B: processed but the action recorded means we know it
          // failed to send (classifier truncation, send errors, etc).
          inArray(emailReplies.actionTaken, FAILURE_ACTIONS),
          // Bucket C: processed, action says "replied", but no message-id
          // was recorded — the old bug, kept as a guardrail for any legacy
          // rows.
          and(
            eq(emailReplies.actionTaken, "replied"),
            isNull(emailReplies.agentResponseMessageId)
          )
        )
      )
    )
    .orderBy(sql`${emailReplies.receivedAt} DESC`)
    .limit(20);

  return rows.map((r) => ({
    id: r.id,
    fromEmail: r.fromEmail,
    subject: r.subject,
    receivedAt: r.receivedAt,
    classification: r.classification,
    actionTaken: r.actionTaken,
    processingError: r.processingError,
  }));
}

async function sendUnrespondedReplyNotice(stuck: StuckReply[]): Promise<void> {
  try {
    const lines = stuck.map((r) => {
      const age = humanAge(Date.now() - new Date(r.receivedAt).getTime());
      const reason =
        r.actionTaken ??
        (r.processingError ? `error: ${r.processingError}` : "never-processed");
      return `- id ${r.id} from ${r.fromEmail} (${age} ago) — ${reason} — "${(r.subject ?? "(no subject)").slice(0, 60)}"`;
    });
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: BABY_FROM_EMAIL,
      to: "noahhshaw@gmail.com",
      subject: `[Daily Baby] ${stuck.length} unresponded reply(s) need attention`,
      text: `One or more inbound replies were not answered within the expected window. Most likely a classifier truncation, send error, or webhook drop.

${lines.join("\n")}

Investigate via the dashboard reply log or:
  GET /api/baby/diag/replies?unprocessed=1
  GET /api/baby/diag/trace?level=error

To re-run the processor for a sender:
  POST /api/baby/diag/replies  body: { "fromEmail": "..." }`,
    });
  } catch (err) {
    console.error("[baby-cron] failed to send unresponded-reply notice", err);
  }
}

function humanAge(ms: number): string {
  const h = Math.floor(ms / (60 * 60 * 1000));
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
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
