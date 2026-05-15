/**
 * Reply processor — pure library, importable from both API routes and crons.
 *
 * Responsibilities:
 *   - Load all unprocessed replies for a sender (or all senders, sweep mode).
 *   - Hold a short Redis mutex per sender so concurrent triggers can't
 *     double-send for the same inbound batch.
 *   - For EACH pending reply (no batching across replies — product rule
 *     from 2026-05-14): run the classifier on that one reply, send at most
 *     one outbound response, threaded under the inbound message-id with
 *     proper References/In-Reply-To/Subject headers.
 *   - Queue feedback items into kb_update_queue.
 *   - Mark each reply processed independently.
 *
 * The per-sender mutex covers concurrency only, not batching: we still
 * process every pending reply in sequence inside one invocation, but each
 * gets its own classifier call and its own send.
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
  type ClassifierResult,
  type ReplyAttachmentInput,
  type ReplyInput,
} from "@/lib/baby/classifier";
import { fetchObjectBase64 } from "@/lib/baby/r2-fetch";
import { computeReplyRecipients } from "@/lib/baby/recipients";
import { getAllRecipientEmails } from "@/lib/baby/recipients-store";
import { newTraceId, trace } from "@/lib/baby/trace";
import {
  cleanReplyHtml,
  cleanReplyText,
  validateReplyHtml,
  validateReplyText,
} from "@/lib/baby/output-cleaner";
import { buildThreadHeaders } from "@/lib/baby/threading";
import {
  buildHtmlWithQuote,
  buildPlainTextWithQuote,
  extractFromName,
} from "@/lib/baby/quoting";

export type ProcessSenderResult = Record<string, unknown>;

const SENDER_LOCK_TTL_SECONDS = 90; // covers worst-case classifier + send

export type ProcessSenderOpts = {
  /** Correlation id from the caller; if omitted a new one is generated. */
  traceId?: string;
};

export async function processSender(
  sender: string,
  opts: ProcessSenderOpts = {}
): Promise<ProcessSenderResult> {
  const traceId = opts.traceId ?? newTraceId("proc");

  const lockKey = `baby:processing:${sender}`;
  let lockAcquired = false;
  if (isRedisConfigured()) {
    const ok = await redis.set(lockKey, String(Date.now()), {
      nx: true,
      ex: SENDER_LOCK_TTL_SECONDS,
    });
    lockAcquired = ok === "OK" || ok === true;
    if (!lockAcquired) {
      await trace("warn", traceId, "proc.lock.held", "another invocation in progress", { sender });
      return { fromEmail: sender, skipped: "already-processing", traceId };
    }
    await trace("info", traceId, "proc.lock.acquired", "mutex held", { sender });
  } else {
    await trace("warn", traceId, "proc.lock.no-redis", "redis unconfigured; concurrency unprotected", { sender });
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
      await trace("info", traceId, "proc.pending.empty", "no unprocessed replies for sender", { sender });
      return { fromEmail: sender, skipped: "none-ready", traceId };
    }
    await trace("info", traceId, "proc.pending.loaded", `${pending.length} unprocessed`, {
      sender,
      pendingIds: pending.map((p) => p.id),
      oldestReceivedAt: pending[0].receivedAt,
    });

    // Cache the parent allow-list once; it doesn't change between replies.
    const parentAllowList = await getAllRecipientEmails();
    const age = await loadAgeContext();

    // Per-reply results aggregated for the return payload + trace.
    const perReply: Array<Record<string, unknown>> = [];
    let combinedCost = 0;

    for (const row of pending) {
      const replyTraceId = newTraceId("proc-r");
      await trace("info", replyTraceId, "proc.reply.start", "processing one reply", {
        parentTraceId: traceId,
        replyId: row.id,
        sender,
      });

      // Lookup linked daily email for this specific reply.
      let originalDaily:
        | {
            sentDate: string;
            subject: string;
            bodyText: string;
            messageId: string | null;
          }
        | undefined;
      if (row.dailyEmailId) {
        const rows = await db
          .select()
          .from(dailyEmails)
          .where(eq(dailyEmails.id, row.dailyEmailId))
          .limit(1);
        if (rows[0]) {
          originalDaily = {
            sentDate: rows[0].sentDate,
            subject: rows[0].subject,
            bodyText: rows[0].bodyText,
            messageId: rows[0].resendMessageId ?? null,
          };
        }
      }

      const replyInput: ReplyInput = {
        receivedAt: new Date(row.receivedAt),
        subject: row.subject,
        bodyText: row.bodyText,
        bodyHtml: row.bodyHtml,
        attachments: await loadAttachmentsForReply(row.id),
      };

      const classifyStartedAt = Date.now();
      let classification: ClassifierResult;
      try {
        classification = await classifyAndDraft({
          fromEmail: sender,
          reply: replyInput,
          originalDailyEmail: originalDaily
            ? {
                sentDate: originalDaily.sentDate,
                subject: originalDaily.subject,
                bodyText: originalDaily.bodyText,
              }
            : undefined,
          babyContext: {
            babyName: null,
            ageInDays: age?.ageInDays ?? -999,
            weekIndex: age?.weekIndex ?? 0,
            status: age?.status ?? "unknown",
          },
        });
      } catch (err) {
        await trace("error", replyTraceId, "proc.classify.threw", "classifyAndDraft error", {
          replyId: row.id,
          durationMs: Date.now() - classifyStartedAt,
          error: err instanceof Error ? err.message : String(err),
        });
        await db
          .update(emailReplies)
          .set({
            processedAt: new Date(),
            classification: null,
            actionTaken: "classify-failed",
            processingError: err instanceof Error ? err.message : String(err),
          })
          .where(eq(emailReplies.id, row.id));
        perReply.push({
          replyId: row.id,
          error: err instanceof Error ? err.message : String(err),
        });
        continue;
      }

      const cost = Number(estimateCost(classification));
      combinedCost += cost;
      await trace("info", replyTraceId, "proc.classify.done", "classifier returned", {
        replyId: row.id,
        durationMs: Date.now() - classifyStartedAt,
        classification: classification.classification,
        shouldReply: classification.shouldReply,
        replyTextLen: classification.replyText?.length ?? 0,
      });

      // Queue feedback items now (independent of send).
      for (const item of classification.feedbackItems) {
        await db.insert(kbUpdateQueue).values({
          requesterEmail: sender,
          sourceReplyId: row.id,
          requestText: `[${item.changeType} → ${item.targetPath}] ${item.changeSummary}\n\nEvidence: "${item.evidenceQuote}"\nConfidence: ${item.confidence}`,
          targetTopic: item.targetPath,
        });
      }

      let agentResponseMessageId: string | null = null;
      let sendError: string | null = null;
      let outboundSubject: string | null = null;
      let outboundRecipients: string[] = [];

      if (classification.shouldReply && classification.replyText) {
        // Audience: ONLY the people on THIS inbound reply (from + to + cc),
        // minus the agent. Never inflated by other pending replies.
        outboundRecipients = computeReplyRecipients(
          [
            {
              fromEmail: row.fromEmail,
              toEmails: row.toEmails,
              ccEmails: row.ccEmails,
            },
          ],
          { parentAllowList }
        );

        // Threading: subject + In-Reply-To + References. The classifier
        // does NOT control the outbound subject — the threading helper
        // forces it to match the inbound thread so Gmail keeps them
        // grouped.
        const threadHeaders = buildThreadHeaders({
          inboundSubject: row.subject,
          inboundMessageId: row.messageId,
          originalDailyMessageId: originalDaily?.messageId ?? null,
          originalDailySubject: originalDaily?.subject ?? null,
        });
        outboundSubject = threadHeaders.Subject;

        // Output sanitation: strip any markdown the model leaked through,
        // ensure HTML is paragraph-wrapped with anchored links. Validate
        // the agent's body BEFORE we attach the quoted inbound thread —
        // otherwise the inbound's own bare URLs / formatting would trip
        // validators that only apply to the agent's authored content.
        const cleanText = cleanReplyText(classification.replyText);
        const cleanHtml = cleanReplyHtml(
          classification.replyHtml ?? cleanText,
          cleanText
        );

        const textCheck = validateReplyText(cleanText);
        const htmlCheck = validateReplyHtml(cleanHtml);
        if (!textCheck.ok || !htmlCheck.ok) {
          await trace("warn", replyTraceId, "proc.output.violations", "post-clean validation found leftovers", {
            replyId: row.id,
            textViolations: textCheck.violations,
            htmlViolations: htmlCheck.violations,
          });
        }

        // Append the quoted inbound thread Gmail-style so the response
        // reads as a normal reply with history visible.
        const quoteSource = {
          fromEmail: row.fromEmail,
          fromName: extractFromName(row.rawHeaders),
          receivedAt: new Date(row.receivedAt),
          bodyText: row.bodyText,
          bodyHtml: row.bodyHtml,
        };
        const finalText = buildPlainTextWithQuote(cleanText, quoteSource);
        const finalHtml = buildHtmlWithQuote(cleanHtml, quoteSource);

        const resendHeaders: Record<string, string> = {};
        if (threadHeaders["In-Reply-To"])
          resendHeaders["In-Reply-To"] = threadHeaders["In-Reply-To"];
        if (threadHeaders.References)
          resendHeaders.References = threadHeaders.References;

        await trace("info", replyTraceId, "proc.send.start", "calling resend", {
          replyId: row.id,
          recipients: outboundRecipients,
          subject: outboundSubject,
          hasInReplyTo: !!resendHeaders["In-Reply-To"],
          hasReferences: !!resendHeaders.References,
        });
        const sendStartedAt = Date.now();
        try {
          const resend = new Resend(process.env.RESEND_API_KEY);
          const result = await resend.emails.send({
            from: BABY_FROM_EMAIL,
            to: outboundRecipients,
            reply_to: BABY_REPLY_TO_EMAIL,
            subject: outboundSubject,
            text: finalText,
            html: finalHtml,
            headers: resendHeaders,
          });
          agentResponseMessageId = result.data?.id ?? null;
          if (result.error) sendError = result.error.message;
          await trace(
            sendError ? "error" : "info",
            replyTraceId,
            "proc.send.done",
            sendError ? "resend returned error" : "resend success",
            {
              replyId: row.id,
              durationMs: Date.now() - sendStartedAt,
              agentResponseMessageId,
              sendError,
            }
          );
        } catch (err) {
          sendError = err instanceof Error ? err.message : String(err);
          await trace("error", replyTraceId, "proc.send.threw", "resend threw", {
            replyId: row.id,
            durationMs: Date.now() - sendStartedAt,
            error: sendError,
          });
        }
      } else {
        await trace("info", replyTraceId, "proc.send.skipped", "classifier said no reply", {
          replyId: row.id,
          shouldReply: classification.shouldReply,
          hasReplyText: !!classification.replyText,
        });
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

      await db
        .update(emailReplies)
        .set({
          processedAt: new Date(),
          classification: classification.classification,
          actionTaken: action,
          agentResponseMessageId,
          processingError: sendError,
        })
        .where(eq(emailReplies.id, row.id));

      perReply.push({
        replyId: row.id,
        classification: classification.classification,
        shouldReply: classification.shouldReply,
        action,
        outboundSubject,
        outboundRecipients,
        agentResponseMessageId,
        sendError,
        feedbackItemsQueued: classification.feedbackItems.length,
        cost: cost.toFixed(6),
      });
    }

    await trace("info", traceId, "proc.done", "processSender complete", {
      sender,
      repliesProcessed: pending.length,
      sends: perReply.filter((p) => p.action === "replied" || p.action === "replied+queued-kb-update").length,
      combinedCost: combinedCost.toFixed(6),
    });

    return {
      fromEmail: sender,
      traceId,
      repliesProcessed: pending.length,
      results: perReply,
      combinedCost: combinedCost.toFixed(6),
    };
  } finally {
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
