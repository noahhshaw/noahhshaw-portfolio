import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { emailReplies, dailyEmails, photos } from "@/db/schema";
import { eq } from "drizzle-orm";
import { isR2Configured, makePhotoKey, uploadBytes } from "@/lib/baby/r2";
import { verifySvixSignature } from "@/lib/baby/svix";
import { processSender } from "@/lib/baby/reply-processor";
import { newTraceId, trace } from "@/lib/baby/trace";

export const runtime = "nodejs";
// We await the classifier inline (5-15s typical, 60s worst case). Set the
// function timeout high enough to cover that without truncating mid-call.
export const maxDuration = 60;

// Resend / Cloudflare Email inbound webhook handler.
//
// Behavior:
//   1. Persist the reply (with raw headers + attachments metadata) to
//      `email_replies` immediately. Duplicate webhook deliveries (same
//      message_id) are absorbed via the unique-constraint catch.
//   2. Call the reply processor in-process. A per-sender Redis mutex inside
//      processSender prevents concurrent triggers from double-sending.
//      Processing takes 5-15s; the inbound function waits so the upstream
//      webhook gets a real success/failure code, but the cron sweep is the
//      safety net if the inline call fails.
//
// Previously we used a 10-min Redis debounce + QStash delayed POST. That
// pipeline was inert without QSTASH_TOKEN and left replies sitting forever.
//
// Resend inbound webhook payload shape is documented at
// https://resend.com/docs/dashboard/inbound — this handler is defensive and
// stores the raw envelope so we can adapt as the payload evolves.

type ResendInboundPayload = {
  type?: string;
  data?: {
    from?: { email?: string; name?: string } | string;
    to?: Array<{ email?: string } | string>;
    cc?: Array<{ email?: string } | string>;
    subject?: string;
    text?: string;
    html?: string;
    headers?: Record<string, string> | Array<{ name: string; value: string }>;
    in_reply_to?: string;
    message_id?: string;
    attachments?: Array<{
      filename?: string;
      content_type?: string;
      size?: number;
      content?: string; // base64
    }>;
  };
};

export async function POST(request: NextRequest) {
  const traceId = newTraceId("inb");
  // We accept inbound from either Cloudflare Email Worker (HMAC-signed) or
  // Resend (svix-signed). The source header disambiguates.
  const source = request.headers.get("x-inbound-source");
  const rawBody = await request.text();
  await trace("info", traceId, "inbound.received", "inbound webhook hit", {
    source,
    bodyLength: rawBody.length,
    contentType: request.headers.get("content-type"),
  });

  if (source === "cloudflare-email") {
    const secret = process.env.INBOUND_WEBHOOK_SECRET;
    if (!secret) {
      await trace(
        "error",
        traceId,
        "inbound.auth.no-secret",
        "INBOUND_WEBHOOK_SECRET missing"
      );
      return NextResponse.json(
        { error: "INBOUND_WEBHOOK_SECRET not configured" },
        { status: 500 }
      );
    }
    const ts = request.headers.get("x-inbound-timestamp");
    const sig = request.headers.get("x-inbound-signature");
    if (!ts || !sig) {
      await trace("warn", traceId, "inbound.auth.missing-headers", "missing sig/ts", { hasTs: !!ts, hasSig: !!sig });
      return NextResponse.json({ error: "missing signature" }, { status: 401 });
    }
    // Reject stale signatures (>5 min) to limit replay window.
    const tsNum = Number(ts);
    if (
      !Number.isFinite(tsNum) ||
      Math.abs(Date.now() / 1000 - tsNum) > 300
    ) {
      await trace("warn", traceId, "inbound.auth.stale", "stale timestamp", {
        ts,
        skewSec: tsNum ? Date.now() / 1000 - tsNum : null,
      });
      return NextResponse.json({ error: "stale timestamp" }, { status: 401 });
    }
    const expected = await hmacHex(secret, `${ts}.${rawBody}`);
    if (!constantTimeEqual(expected, sig)) {
      await trace("error", traceId, "inbound.auth.bad-sig", "HMAC mismatch");
      return NextResponse.json({ error: "invalid signature" }, { status: 401 });
    }
    await trace("info", traceId, "inbound.auth.ok", "cloudflare-email signature verified");
  } else {
    // Legacy / Resend path. Verify svix headers if a secret is set.
    const svixId = request.headers.get("svix-id");
    const svixTimestamp = request.headers.get("svix-timestamp");
    const svixSignature = request.headers.get("svix-signature");
    const webhookSecret = process.env.RESEND_INBOUND_WEBHOOK_SECRET;
    if (webhookSecret) {
      const ok = await verifySvixSignature({
        secret: webhookSecret,
        id: svixId,
        timestamp: svixTimestamp,
        signature: svixSignature,
        body: rawBody,
      });
      if (!ok) {
        await trace("error", traceId, "inbound.auth.bad-svix", "svix mismatch");
        return NextResponse.json({ error: "invalid signature" }, { status: 401 });
      }
    }
    await trace("info", traceId, "inbound.auth.ok", "resend/svix path");
  }

  let payload: ResendInboundPayload;
  try {
    payload = JSON.parse(rawBody) as ResendInboundPayload;
  } catch {
    await trace("error", traceId, "inbound.parse.bad-json", "JSON parse failed");
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const data = payload.data ?? {};
  const fromEmail = extractEmail(data.from)?.toLowerCase().trim();
  if (!fromEmail) {
    await trace("error", traceId, "inbound.parse.no-from", "no from email", {
      rawFrom: data.from,
    });
    return NextResponse.json({ error: "missing from" }, { status: 400 });
  }
  await trace("info", traceId, "inbound.parsed", "payload parsed", {
    fromEmail,
    subject: data.subject?.slice(0, 80) ?? null,
    messageId: data.message_id ?? null,
    inReplyTo: data.in_reply_to ?? null,
    hasText: !!data.text,
    hasHtml: !!data.html,
    attachmentCount: data.attachments?.length ?? 0,
  });

  const toEmails = (Array.isArray(data.to) ? data.to : [])
    .map(extractEmail)
    .filter((e): e is string => !!e)
    .map((e) => e.toLowerCase());
  const ccEmails = (Array.isArray(data.cc) ? data.cc : [])
    .map(extractEmail)
    .filter((e): e is string => !!e)
    .map((e) => e.toLowerCase());

  const inReplyTo = data.in_reply_to;
  let dailyEmailId: number | null = null;
  if (inReplyTo) {
    const matches = await db
      .select({ id: dailyEmails.id })
      .from(dailyEmails)
      .where(eq(dailyEmails.resendMessageId, inReplyTo))
      .limit(1);
    dailyEmailId = matches[0]?.id ?? null;
  }

  // Insert reply. The schema has a UNIQUE constraint on message_id, so a
  // duplicate webhook delivery (upstream retry, double-fire) returns the
  // existing row instead of erroring. We treat duplicates as "already
  // accepted" — the original delivery already triggered processing.
  let replyId: number;
  let duplicate = false;
  try {
    const inserted = await db
      .insert(emailReplies)
      .values({
        fromEmail,
        toEmails,
        ccEmails,
        subject: data.subject ?? null,
        bodyText: data.text ?? null,
        bodyHtml: data.html ?? null,
        inReplyTo: inReplyTo ?? null,
        messageId: data.message_id ?? null,
        dailyEmailId,
        rawHeaders: data.headers ?? null,
      })
      .returning();
    replyId = inserted[0].id;
    await trace("info", traceId, "inbound.persisted", "reply row inserted", {
      replyId,
      dailyEmailId,
      fromEmail,
    });
  } catch (err) {
    const isDup =
      data.message_id &&
      err instanceof Error &&
      /unique|duplicate/i.test(err.message);
    if (!isDup) {
      await trace("error", traceId, "inbound.persist.failed", "DB insert threw", {
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
    const existing = await db
      .select({ id: emailReplies.id })
      .from(emailReplies)
      .where(eq(emailReplies.messageId, data.message_id!))
      .limit(1);
    if (!existing[0]) throw err;
    replyId = existing[0].id;
    duplicate = true;
    await trace("warn", traceId, "inbound.persist.duplicate", "message_id seen before", {
      replyId,
      messageId: data.message_id,
    });
  }

  // Persist any image attachments to R2 + photos rows. Non-image attachments
  // are stored to R2 but not surfaced in the photo gallery.
  let attachmentsStored = 0;
  if (Array.isArray(data.attachments) && data.attachments.length > 0) {
    attachmentsStored = await persistAttachments({
      attachments: data.attachments,
      uploadedByEmail: fromEmail,
      replyId,
    });
  }

  // Run the processor inline. Per-sender Redis mutex inside processSender
  // protects against concurrent triggers. If this throws, the reply is
  // already persisted — the 5-minute cron sweep at /api/cron/process-replies
  // is the safety net.
  let processorResult: Record<string, unknown> | null = null;
  let processorError: string | null = null;
  if (duplicate) {
    processorResult = { skipped: "duplicate-message-id" };
    await trace("info", traceId, "inbound.processor.skipped", "dup-message-id", {
      replyId,
    });
  } else {
    await trace("info", traceId, "inbound.processor.start", "calling processSender", {
      replyId,
      fromEmail,
    });
    const startedAt = Date.now();
    try {
      processorResult = await processSender(fromEmail, { traceId });
      await trace(
        "info",
        traceId,
        "inbound.processor.done",
        "processSender returned",
        {
          replyId,
          durationMs: Date.now() - startedAt,
          ...processorResult,
        }
      );
    } catch (err) {
      processorError = err instanceof Error ? err.message : String(err);
      await trace("error", traceId, "inbound.processor.threw", "processSender error", {
        replyId,
        durationMs: Date.now() - startedAt,
        error: processorError,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    traceId,
    replyId,
    duplicate,
    attachmentsStored,
    processorResult,
    processorError,
  });
}

async function persistAttachments(opts: {
  attachments: NonNullable<NonNullable<ResendInboundPayload["data"]>["attachments"]>;
  uploadedByEmail: string;
  replyId: number;
}): Promise<number> {
  if (!isR2Configured()) {
    console.warn(
      "[baby-inbound] attachments present but R2 is not configured; skipping"
    );
    return 0;
  }
  let stored = 0;
  for (const att of opts.attachments) {
    const filename = att.filename ?? "attachment";
    const contentType = att.content_type ?? "application/octet-stream";
    const base64 = att.content;
    if (!base64) continue;
    let bytes: Uint8Array;
    try {
      bytes = Uint8Array.from(Buffer.from(base64, "base64"));
    } catch {
      console.error("[baby-inbound] failed to decode attachment", filename);
      continue;
    }
    const key = makePhotoKey({
      uploadedByEmail: opts.uploadedByEmail,
      filename,
    });
    try {
      await uploadBytes({ key, bytes, contentType });
    } catch (err) {
      console.error("[baby-inbound] R2 upload failed", filename, err);
      continue;
    }
    if (contentType.startsWith("image/")) {
      try {
        await db.insert(photos).values({
          r2Key: key,
          mimeType: contentType,
          sizeBytes: bytes.byteLength,
          uploadedByEmail: opts.uploadedByEmail,
          sourceReplyId: opts.replyId,
        });
        stored += 1;
      } catch (err) {
        console.error("[baby-inbound] photos insert failed", filename, err);
      }
    } else {
      stored += 1;
    }
  }
  return stored;
}

function extractEmail(v: unknown): string | undefined {
  if (!v) return undefined;
  if (typeof v === "string") return v;
  if (typeof v === "object" && v !== null && "email" in v) {
    const e = (v as { email?: unknown }).email;
    return typeof e === "string" ? e : undefined;
  }
  return undefined;
}

async function hmacHex(secret: string, input: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(input)
  );
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
