import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { Resend } from "resend";
import { getCurrentParent } from "@/lib/baby/session";
import { BABY_FROM_EMAIL, BABY_REPLY_TO_EMAIL } from "@/lib/baby/constants";

export const runtime = "nodejs";
export const maxDuration = 60;

// Manually send pre-computed emails to a chosen address list for review.
// Does NOT write to daily_emails (this is review/test mode, not a production
// send).
//
// Default recipient: noahhshaw@gmail.com (so review never accidentally goes
// out to the broader recipient list). Subject is prefixed [TEST DAY N].
//
// Usage (browser, while logged in):
//   /api/baby/test-send?days=0,7,14
//   /api/baby/test-send?days=0&to=noahhshaw@gmail.com,other@example.com

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

    try {
      const result = await resend.emails.send({
        from: BABY_FROM_EMAIL,
        to: recipients,
        reply_to: BABY_REPLY_TO_EMAIL,
        subject: `[TEST DAY ${day}] ${artifact.subject}`,
        text: artifact.bodyText,
        html: artifact.bodyHtml,
        headers: {
          "X-Baby-Source": "test-send",
          "X-Baby-Day": String(day),
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

  return NextResponse.json({ recipients, results });
}
