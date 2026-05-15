import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { Resend } from "resend";
import { getCurrentParent } from "@/lib/baby/session";
import { BABY_FROM_EMAIL, BABY_REPLY_TO_EMAIL } from "@/lib/baby/constants";
import {
  getDefaultBabyProfileId,
  loadSurfaceableMilestones,
  renderCheckInHtml,
  renderCheckInText,
} from "@/lib/baby/milestones";
import { loadAgeContext } from "@/lib/baby/age";

export const runtime = "nodejs";
export const maxDuration = 60;

// Manually send pre-computed emails to a chosen address list for review.
// Does NOT write to daily_emails (this is review/test mode, not a production
// send).
//
// Default recipient: noahhshaw@gmail.com (so review never accidentally goes
// out to the broader recipient list). Subject is prefixed [TEST DAY N].
//
// Query params:
//   days=0,7,14               which artifacts to send (comma-sep)
//   to=a@b.com,c@d.com        recipients (default: noahhshaw@gmail.com)
//   withMilestones=1          append the Developmental Milestone Check-In
//                             section (queries current state for today's
//                             age, NOT the day-N being sent — gives an
//                             accurate preview of what the next gen run
//                             would inline)
//
// Usage (browser, while logged in):
//   /api/baby/test-send?days=0,7,14
//   /api/baby/test-send?days=5&withMilestones=1

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}

async function handle(request: NextRequest) {
  const parent = await getCurrentParent();
  if (!parent)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const daysParam = request.nextUrl.searchParams.get("days");
  const toParam = request.nextUrl.searchParams.get("to");
  if (!daysParam) {
    return NextResponse.json(
      { error: "missing ?days=0,7,14" },
      { status: 400 }
    );
  }
  const days = daysParam
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n));
  if (days.length === 0) {
    return NextResponse.json({ error: "no valid days" }, { status: 400 });
  }
  const recipients = (toParam ?? "noahhshaw@gmail.com")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const withMilestones =
    request.nextUrl.searchParams.get("withMilestones") === "1";

  // Build the check-in section once per request — it's keyed off Avi's
  // current age, not the day-N artifact, so it's the same fragment for
  // every email in this send.
  let milestoneHtml = "";
  let milestoneText = "";
  let milestonesUsed: number = 0;
  if (withMilestones) {
    const babyId = await getDefaultBabyProfileId();
    const age = await loadAgeContext();
    const origin = request.nextUrl.origin;
    if (babyId && age) {
      const rows = await loadSurfaceableMilestones({
        babyProfileId: babyId,
        ageInDays: age.ageInDays,
        limit: 5,
      });
      milestoneHtml = renderCheckInHtml({ rows, origin });
      milestoneText = renderCheckInText({ rows, origin });
      milestonesUsed = rows.length;
    }
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const results: Array<{
    day: number;
    status: "sent" | "missing" | "error";
    error?: string;
    messageId?: string;
  }> = [];

  for (const day of days) {
    const file = path.join(
      process.cwd(),
      "baby-kb",
      "precomputed",
      `day-${day}.json`
    );
    let artifact: {
      subject: string;
      bodyHtml: string;
      bodyText: string;
    } | null = null;
    try {
      const content = await fs.readFile(file, "utf8");
      artifact = JSON.parse(content);
    } catch {
      results.push({ day, status: "missing" });
      continue;
    }
    if (!artifact) {
      results.push({ day, status: "missing" });
      continue;
    }

    // Inject milestone section before the closing </body> tag if present,
    // otherwise append. Plain text just appends after a blank line.
    let bodyHtml = artifact.bodyHtml;
    let bodyText = artifact.bodyText;
    if (milestoneHtml) {
      bodyHtml = /<\/body>/i.test(bodyHtml)
        ? bodyHtml.replace(/<\/body>/i, `${milestoneHtml}</body>`)
        : `${bodyHtml}\n${milestoneHtml}`;
      bodyText = `${bodyText.trimEnd()}\n\n${milestoneText}`;
    }

    try {
      const result = await resend.emails.send({
        from: BABY_FROM_EMAIL,
        to: recipients,
        reply_to: BABY_REPLY_TO_EMAIL,
        subject: `[TEST DAY ${day}] ${artifact.subject}`,
        text: bodyText,
        html: bodyHtml,
        headers: {
          "X-Baby-Source": "test-send",
          "X-Baby-Day": String(day),
          "X-Baby-With-Milestones": withMilestones ? "1" : "0",
        },
      });
      results.push({
        day,
        status: result.error ? "error" : "sent",
        error: result.error?.message,
        messageId: result.data?.id,
      });
    } catch (err) {
      results.push({
        day,
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    recipients,
    results,
    withMilestones,
    milestonesIncluded: milestonesUsed,
  });
}
