import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  emailReplies,
  dailyEmails,
  photos,
  parentContext,
  kbUpdateQueue,
} from "@/db/schema";
import {
  isNull,
  eq,
  and,
  gte,
  asc,
  desc,
} from "drizzle-orm";
import { Resend } from "resend";
import { redis, isRedisConfigured } from "@/lib/redis";
import {
  REPLY_DEBOUNCE_SECONDS,
  BABY_FROM_EMAIL,
  BABY_REPLY_TO_EMAIL,
} from "@/lib/baby/constants";
import { loadAgeContext } from "@/lib/baby/age";
import {
  classifyAndDraft,
  estimateCost,
  type ReplyAttachmentInput,
  type ReplyInput,
} from "@/lib/baby/classifier";
import { fetchObjectBase64 } from "@/lib/baby/r2-fetch";
import { computeReplyRecipients, plainToHtml } from "@/lib/baby/recipients";
import { getCurrentParent } from "@/lib/baby/session";

export const runtime = "nodejs";
// Allow longer execution since this calls the Anthropic API.
export const maxDuration = 60;

// Reply processor.
//
// Triggered either by:
//   1. QStash deferred POST after the 10-minute debounce window, or
//   2. A periodic cron sweep (no body) that scans all senders with
//      ready-to-process replies.
//
// For each sender:
//   - Loads all unprocessed replies + linked attachments + the daily email
//     they were replying to
//   - Calls the multimodal classifier
//   - If classifier says reply: sends via Resend, attributing only to the
//     inbound message's recipients (not all parents)
//   - Persists any context entries to parent_context
//   - Queues any kb_update_request rows
//   - Marks replies processed

type ProcessRequestBody = {
  fromEmail?: string;
  triggerReplyId?: number;
};

export async function POST(request: NextRequest) {
  // Accept any of: BABY_INTERNAL_SECRET (routine), QStash signature
  // (deferred), or an authenticated parent session (manual trigger from
  // dashboard).
  const auth = request.headers.get("authorization");
  const upstashSig = request.headers.get("upstash-signature");
  const internalSecret = process.env.BABY_INTERNAL_SECRET;
  const internalAuthOk =
    !!internalSecret && auth === `Bearer ${internalSecret}`;
  const qstashAuthOk = !!upstashSig;
  let sessionAuthOk = false;
  if (!internalAuthOk && !qstashAuthOk) {
    const parent = await getCurrentParent();
    sessionAuthOk = !!parent;
  }
  if (!internalAuthOk && !qstashAuthOk && !sessionAuthOk) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: ProcessRequestBody = {};
  try {
    body = (await request.json()) as ProcessRequestBody;
  } catch {
    // sweep mode: no body
  }

  const targetSenders = body.fromEmail
    ? [body.fromEmail.toLowerCase()]
    : await loadSendersWithReadyReplies();

  const results: Array<Record<string, unknown>> = [];
  for (const sender of targetSenders) {
    try {
      results.push(await processSender(sender));
    } catch (err) {
      console.error("[process-replies] error processing", sender, err);
      results.push({
        fromEmail: sender,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({ ok: true, results });
}

async function processSender(sender: string): Promise<Record<string, unknown>> {
  const ready = await debounceReady(sender);
  if (!ready) {
    return { fromEmail: sender, skipped: "still-debouncing" };
  }

  const pending = await db
    .select()
    .from(emailReplies)
    .where(
      and(eq(emailReplies.fromEmail, sender), isNull(emailReplies.processedAt))
    )
    .orderBy(asc(emailReplies.receivedAt));

  if (pending.length === 0) {
    return { fromEmail: sender, skipped: "none-ready" };
  }

  // Load attachments per reply
  const replyInputs: ReplyInput[] = await Promise.all(
    pending.map(async (r) => {
      const atts = await loadAttachmentsForReply(r.id);
      return {
        receivedAt: new Date(r.receivedAt),
        subject: r.subject,
        bodyText: r.bodyText,
        bodyHtml: r.bodyHtml,
        attachments: atts,
      };
    })
  );

  // Load original daily email if any
  const dailyEmailId = pending.find((r) => r.dailyEmailId !== null)?.dailyEmailId;
  let originalDaily: { sentDate: string; subject: string; bodyText: string } | undefined;
  if (dailyEmailId) {
    const rows = await db
      .select()
      .from(dailyEmails)
      .where(eq(dailyEmails.id, dailyEmailId))
      .limit(1);
    if (rows[0]) {
      originalDaily = {
        sentDate: rows[0].sentDate,
        subject: rows[0].subject,
        bodyText: rows[0].bodyText,
      };
    }
  }

  // Load age + recent context
  const age = await loadAgeContext();
  const recentRows = await db
    .select({
      contentType: parentContext.contentType,
      content: parentContext.content,
    })
    .from(parentContext)
    .where(
      gte(
        parentContext.createdAt,
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      )
    )
    .orderBy(desc(parentContext.createdAt))
    .limit(15);

  // Run classifier
  const classification = await classifyAndDraft({
    fromEmail: sender,
    replies: replyInputs,
    originalDailyEmail: originalDaily,
    babyContext: {
      babyName: null,
      ageInDays: age?.ageInDays ?? -999,
      weekIndex: age?.weekIndex ?? 0,
      status: age?.status ?? "unknown",
    },
    recentParentContext: recentRows,
  });

  const cost = estimateCost(classification);

  // Persist context entries
  for (const ctx of classification.contextToStore) {
    await db.insert(parentContext).values({
      source: "reply",
      sourceReplyId: pending[0].id,
      contentType: ctx.contentType,
      content: ctx.content,
      tags: ctx.tags,
    });
  }

  // Queue one KB-update request per feedback item.
  for (const item of classification.feedbackItems) {
    await db.insert(kbUpdateQueue).values({
      requesterEmail: sender,
      sourceReplyId: pending[0].id,
      requestText: `[${item.changeType} → ${item.targetPath}] ${item.changeSummary}\n\nEvidence: "${item.evidenceQuote}"\nConfidence: ${item.confidence}`,
      targetTopic: item.targetPath,
    });
  }

  // Send the reply if warranted
  let agentResponseMessageId: string | null = null;
  let sendError: string | null = null;
  if (
    classification.shouldReply &&
    classification.replyText &&
    classification.replySubject
  ) {
    const recipients = computeReplyRecipients(pending);
    const inReplyToHeaders: Record<string, string> = {};
    const lastMessageId = pending[pending.length - 1].messageId;
    if (lastMessageId) {
      inReplyToHeaders["In-Reply-To"] = lastMessageId;
      inReplyToHeaders["References"] = lastMessageId;
    }
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const result = await resend.emails.send({
        from: BABY_FROM_EMAIL,
        to: recipients,
        reply_to: BABY_REPLY_TO_EMAIL,
        subject: classification.replySubject,
        text: classification.replyText,
        html: classification.replyHtml ?? plainToHtml(classification.replyText),
        headers: inReplyToHeaders,
      });
      agentResponseMessageId = result.data?.id ?? null;
      if (result.error) sendError = result.error.message;
    } catch (err) {
      sendError = err instanceof Error ? err.message : String(err);
    }
  }

  // Mark replies processed
  const action = sendError
    ? "send-failed"
    : classification.shouldReply
    ? classification.feedbackItems.length > 0
      ? "replied+queued-kb-update"
      : "replied"
    : classification.feedbackItems.length > 0
    ? "queued-kb-update"
    : classification.classification === "context" ||
      classification.classification === "photo-only"
    ? "stored-context"
    : "silent";

  for (const r of pending) {
    await db
      .update(emailReplies)
      .set({
        processedAt: new Date(),
        classification: classification.classification,
        actionTaken: action,
        agentResponseMessageId,
        processingError: sendError,
      })
      .where(eq(emailReplies.id, r.id));
  }

  return {
    fromEmail: sender,
    repliesProcessed: pending.length,
    classification: classification.classification,
    shouldReply: classification.shouldReply,
    action,
    agentResponseMessageId,
    sendError,
    contextStored: classification.contextToStore.length,
    feedbackItemsQueued: classification.feedbackItems.length,
    cost,
    tokens: {
      input: classification.inputTokens,
      output: classification.outputTokens,
      cacheRead: classification.cacheReadTokens,
      cacheCreation: classification.cacheCreationTokens,
    },
  };
}

async function loadAttachmentsForReply(
  replyId: number
): Promise<ReplyAttachmentInput[]> {
  const rows = await db
    .select({
      r2Key: photos.r2Key,
      mimeType: photos.mimeType,
    })
    .from(photos)
    .where(eq(photos.sourceReplyId, replyId));

  if (rows.length === 0) return [];

  const out: ReplyAttachmentInput[] = [];
  for (const r of rows) {
    if (!r.mimeType.startsWith("image/")) continue;
    const fetched = await fetchObjectBase64(r.r2Key);
    if (!fetched) continue;
    out.push({
      base64: fetched.base64,
      mediaType: fetched.contentType,
      filename: r.r2Key.split("/").pop(),
    });
  }
  return out;
}

async function debounceReady(sender: string): Promise<boolean> {
  if (!isRedisConfigured()) {
    const latest = await db
      .select()
      .from(emailReplies)
      .where(
        and(eq(emailReplies.fromEmail, sender), isNull(emailReplies.processedAt))
      )
      .orderBy(desc(emailReplies.receivedAt))
      .limit(1);
    const latestRow = latest[0];
    if (!latestRow) return false;
    const ageSeconds =
      (Date.now() - new Date(latestRow.receivedAt).getTime()) / 1000;
    return ageSeconds >= REPLY_DEBOUNCE_SECONDS;
  }
  const key = `baby:debounce:${sender}`;
  const value = await redis.get(key);
  return value === null;
}

async function loadSendersWithReadyReplies(): Promise<string[]> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const rows = await db
    .selectDistinct({ fromEmail: emailReplies.fromEmail })
    .from(emailReplies)
    .where(
      and(
        isNull(emailReplies.processedAt),
        gte(emailReplies.receivedAt, since)
      )
    );
  return rows.map((r) => r.fromEmail);
}
