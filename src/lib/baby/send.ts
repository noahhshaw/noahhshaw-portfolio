import { Resend } from "resend";
import { db } from "@/db";
import { dailyEmails } from "@/db/schema";
import { BABY_FROM_EMAIL, BABY_REPLY_TO_EMAIL } from "./constants";
import { getDailyEmailRecipients } from "./recipients-store";

// Light wrapper around Resend with logging into daily_emails.

type Render = {
  subject: string;
  html: string;
  text: string;
  citations: string[];
};

export async function sendDaily(opts: {
  render: Render;
  ageInDays: number;
  sentDate: string;
  sourcePath: "precomputed";
  recipients?: string[];
  costUsd?: string;
  tokensUsed?: number;
}) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const recipients =
    opts.recipients && opts.recipients.length > 0
      ? opts.recipients
      : await getDailyEmailRecipients();

  let messageId: string | null = null;
  let error: string | null = null;
  try {
    const result = await resend.emails.send({
      from: BABY_FROM_EMAIL,
      to: recipients,
      reply_to: BABY_REPLY_TO_EMAIL,
      subject: opts.render.subject,
      html: opts.render.html,
      text: opts.render.text,
      headers: {
        "X-Baby-Source": opts.sourcePath,
      },
    });
    messageId = result.data?.id ?? null;
    if (result.error) {
      error = result.error.message;
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  const inserted = await db
    .insert(dailyEmails)
    .values({
      sentDate: opts.sentDate,
      ageInDays: opts.ageInDays,
      subject: opts.render.subject,
      bodyHtml: opts.render.html,
      bodyText: opts.render.text,
      recipients,
      resendMessageId: messageId,
      sourcePath: opts.sourcePath,
      status: error ? "failed" : "sent",
      error,
      costUsd: opts.costUsd,
      tokensUsed: opts.tokensUsed,
    })
    .onConflictDoUpdate({
      target: dailyEmails.sentDate,
      set: {
        subject: opts.render.subject,
        bodyHtml: opts.render.html,
        bodyText: opts.render.text,
        recipients,
        resendMessageId: messageId,
        sourcePath: opts.sourcePath,
        status: error ? "failed" : "sent",
        error,
      },
    })
    .returning();

  return { messageId, error, dailyEmail: inserted[0] };
}
