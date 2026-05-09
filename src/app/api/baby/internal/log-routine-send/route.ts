import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { dailyEmails } from "@/db/schema";
import { checkInternalAuth } from "@/lib/baby/internal-auth";

export const runtime = "nodejs";

type LogPayload = {
  sentDate: string; // YYYY-MM-DD
  ageInDays: number;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  recipients: string[];
  resendMessageId?: string;
  citations?: string[];
  tokensUsed?: number;
  costUsd?: string;
};

// POST /api/baby/internal/log-routine-send
// Called by the Claude routine after it has sent today's email via Resend
// directly. Persists the daily_emails row so the cron-fallback knows not
// to fire.

export async function POST(request: NextRequest) {
  const denied = checkInternalAuth(request);
  if (denied) return denied;

  let body: LogPayload;
  try {
    body = (await request.json()) as LogPayload;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (
    !body.sentDate ||
    typeof body.ageInDays !== "number" ||
    !body.subject ||
    !body.bodyHtml ||
    !body.bodyText ||
    !Array.isArray(body.recipients)
  ) {
    return NextResponse.json(
      { error: "missing required fields" },
      { status: 400 }
    );
  }

  const inserted = await db
    .insert(dailyEmails)
    .values({
      sentDate: body.sentDate,
      ageInDays: body.ageInDays,
      subject: body.subject,
      bodyHtml: body.bodyHtml,
      bodyText: body.bodyText,
      recipients: body.recipients,
      resendMessageId: body.resendMessageId ?? null,
      sourcePath: "routine",
      status: "sent",
      tokensUsed: body.tokensUsed,
      costUsd: body.costUsd,
    })
    .onConflictDoUpdate({
      target: dailyEmails.sentDate,
      set: {
        subject: body.subject,
        bodyHtml: body.bodyHtml,
        bodyText: body.bodyText,
        recipients: body.recipients,
        resendMessageId: body.resendMessageId ?? null,
        sourcePath: "routine",
        status: "sent",
        error: null,
        tokensUsed: body.tokensUsed,
        costUsd: body.costUsd,
      },
    })
    .returning();

  return NextResponse.json({ ok: true, dailyEmailId: inserted[0]?.id });
}
