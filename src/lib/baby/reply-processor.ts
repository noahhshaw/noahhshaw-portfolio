/**
 * Reply processor — pure library, importable from both API routes and crons.
 *
 * Responsibilities:
 *   - Load all unprocessed replies for a sender (or all senders, sweep mode).
 *   - Hold a short Redis mutex per sender so concurrent triggers can't
 *     double-send a response.
 *   - Run the classifier on the batch + linked attachments + original email.
 *   - Send the agent's reply (if any) via Resend.
 *   - Queue feedback items into kb_update_queue.
 *   - Mark replies processed.
 *
 * Originally lived inside `/api/baby/internal/process-replies/route.ts`.
 * Extracted so the inbound webhook can call it in-process — no extra
 * HTTP hop, no extra Lambda cold-start, no extra failure surface.
 */

import { db } from "@/db";
import {
  emailReplies,
  dailyEmails,
  photos,
  kbUpdateQueue,
} from "@/db/schema";
import { isNull, eq, and, gte, asc } from "drizzle-orm";
import { Resend } from "resend";
import { redis, isRedisConfigured } from "@/lib/redis";
import { BABY_FROM_EMAIL, BABY_REPLY_TO_EMAIL } from "@/lib/baby/constants";
import { loadAgeContext } from "@/lib/baby/age";
import {
  classifyAndDraft,
  estimateCost,
  type ReplyAttachmentInput,
  type ReplyInput,
} from "@/lib/baby/classifier";
import { fetchObjectBase64 } from "@/lib/baby/r2-fetch";
import { computeReplyRecipients, plainToHtml } from "@/lib/baby/recipients";
import { getAllRecipientEmails } from "@/lib/baby/recipients-store";

export type ProcessSenderResult = Record<string, unknown>;

const SENDER_LOCK_TTL_SECONDS = 90; // covers worst-case classifier + send

export async function processSender(
  sender: string
): Promise<ProcessSenderResult> {
  // Per-sender Redis mutex. If two inbound webhooks race (e.g. Cloudflare
  // Worker retry while the first call is still in-flight), only one of them
  // will run the classifier and send a response. The loser bails fast.
  const lockKey = `baby:processing:${sender}`;
  let lockAcquired = false;
  if (isRedisConfigured()) {
    const ok = await redis.set(lockKey, String(Date.now()), {
      nx: true,
      ex: SENDER_LOCK_TTL_SECONDS,
    });
    lockAcquired = ok === "OK" || ok === true;
    if (!lockAcquired) {
      return { fromEmail: sender, skipped: "already-processing" };
    }
  }

  try {
    const pending = await db
      .select()
      .from(emailReplies)
      .where(
        and(
          eq(emailReplies.fromEmail, sender),
          isNull(emailReplies.processedAt)
        )
      )
      .orderBy(asc(emailReplies.receivedAt));

    if (pending.length === 0) {
      return { fromEmail: sender, skipped: "none-ready" };
    }

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

    const dailyEmailId = pending.find((r) => r.dailyEmailId !== null)
      ?.dailyEmailId;
    let originalDaily:
      | { sentDate: string; subject: string; bodyText: string }
      | undefined;
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

    const age = await loadAgeContext();

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
    });

    const cost = estimateCost(classification);

    for (const item of classification.feedbackItems) {
      await db.insert(kbUpdateQueue).values({
        requesterEmail: sender,
        sourceReplyId: pending[0].id,
        requestText: `[${item.changeType} → ${item.targetPath}] ${item.changeSummary}\n\nEvidence: "${item.evidenceQuote}"\nConfidence: ${item.confidence}`,
        targetTopic: item.targetPath,
      });
    }

    let agentResponseMessageId: string | null = null;
    let sendError: string | null = null;
    if (
      classification.shouldReply &&
      classification.replyText &&
      classification.replySubject
    ) {
      const parentAllowList = await getAllRecipientEmails();
      const recipients = computeReplyRecipients(pending, { parentAllowList });
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
          html:
            classification.replyHtml ?? plainToHtml(classification.replyText),
          headers: inReplyToHeaders,
        });
        agentResponseMessageId = result.data?.id ?? null;
        if (result.error) sendError = result.error.message;
      } catch (err) {
        sendError = err instanceof Error ? err.message : String(err);
      }
    }

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
  } finally {
    // Best-effort lock release. If this throws (network hiccup) the TTL
    // will expire it within SENDER_LOCK_TTL_SECONDS.
    if (lockAcquired && isRedisConfigured()) {
      try {
        await redis.del(lockKey);
      } catch (err) {
        console.error("[reply-processor] lock release failed", sender, err);
      }
    }
  }
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

export async function loadSendersWithReadyReplies(): Promise<string[]> {
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

/**
 * Sweep mode — process every sender with unprocessed replies. Used by the
 * cron backstop and the dashboard "Process pending now" button. Returns
 * one result per sender attempted.
 */
export async function processAllPendingSenders(): Promise<
  ProcessSenderResult[]
> {
  const senders = await loadSendersWithReadyReplies();
  const results: ProcessSenderResult[] = [];
  for (const sender of senders) {
    try {
      results.push(await processSender(sender));
    } catch (err) {
      console.error("[reply-processor] sweep error", sender, err);
      results.push({
        fromEmail: sender,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return results;
}
