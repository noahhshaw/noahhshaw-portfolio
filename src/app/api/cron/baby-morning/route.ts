import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { Resend } from "resend";
import { db } from "@/db";
import { dailyEmails, agentSettings, babyProfile } from "@/db/schema";
import { eq } from "drizzle-orm";
import { loadAgeContext } from "@/lib/baby/age";
import { sendDaily } from "@/lib/baby/send";
import { BABY_FROM_EMAIL } from "@/lib/baby/constants";

export const runtime = "nodejs";

// Daily 7am Pacific cron. Reads a pre-generated email artifact from
// baby-kb/precomputed/day-<ageInDays>.json, sends via Resend, logs.
//
// There is NO live AI rendering at send time and NO fallback template.
// If the artifact is missing, the cron sends an error notice to Noah's
// inbox and returns 500. Re-run the pre-compute pipeline (in Claude Code)
// to fix.

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

  return NextResponse.json({
    ok: !result.error,
    error: result.error,
    messageId: result.messageId,
    dailyEmailId: result.dailyEmail?.id,
    sentDate: todayKey,
    ageInDays: age.ageInDays,
    kbVersion: artifact.kbVersion ?? null,
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

function isoDateInPacific(now: Date): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(now);
}
