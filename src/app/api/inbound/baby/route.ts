import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { emailReplies, dailyEmails, photos } from "@/db/schema";
import { eq } from "drizzle-orm";
import { redis, isRedisConfigured } from "@/lib/redis";
import { REPLY_DEBOUNCE_SECONDS } from "@/lib/baby/constants";
import { isR2Configured, makePhotoKey, uploadBytes } from "@/lib/baby/r2";
import { verifySvixSignature } from "@/lib/baby/svix";

export const runtime = "nodejs";

// Resend inbound webhook handler.
//
// Behavior:
//   1. Persist the reply (with raw headers + attachments metadata) to
//      `email_replies` immediately so nothing is lost if processing crashes.
//   2. Push a debounce marker to Redis with a 10-min TTL keyed by the sender
//      email. The processor (see /api/baby/internal/process-replies) checks
//      this key and waits until it's expired before batching.
//   3. Schedule deferred processing.
//      - If QSTASH_TOKEN is set: publish a delayed POST to the processor.
//      - Otherwise: rely on a per-minute cron (`process-replies`) to scan.
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
  // We accept inbound from either Cloudflare Email Worker (HMAC-signed) or
  // Resend (svix-signed). The source header disambiguates.
  const source = request.headers.get("x-inbound-source");
  const rawBody = await request.text();

  if (source === "cloudflare-email") {
    const secret = process.env.INBOUND_WEBHOOK_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: "INBOUND_WEBHOOK_SECRET not configured" },
        { status: 500 }
      );
    }
    const ts = request.headers.get("x-inbound-timestamp");
    const sig = request.headers.get("x-inbound-signature");
    if (!ts || !sig) {
      return NextResponse.json({ error: "missing signature" }, { status: 401 });
    }
    // Reject stale signatures (>5 min) to limit replay window.
    const tsNum = Number(ts);
    if (
      !Number.isFinite(tsNum) ||
      Math.abs(Date.now() / 1000 - tsNum) > 300
    ) {
      return NextResponse.json({ error: "stale timestamp" }, { status: 401 });
    }
    const expected = await hmacHex(secret, `${ts}.${rawBody}`);
    if (!constantTimeEqual(expected, sig)) {
      return NextResponse.json({ error: "invalid signature" }, { status: 401 });
    }
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
        return NextResponse.json({ error: "invalid signature" }, { status: 401 });
      }
    }
  }

  let payload: ResendInboundPayload;
  try {
    payload = JSON.parse(rawBody) as ResendInboundPayload;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const data = payload.data ?? {};
  const fromEmail = extractEmail(data.from)?.toLowerCase().trim();
  if (!fromEmail) {
    return NextResponse.json({ error: "missing from" }, { status: 400 });
  }

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

  const replyId = inserted[0].id;

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

  // Debounce marker — the processor uses this to know whether to batch or wait.
  if (isRedisConfigured()) {
    const key = `baby:debounce:${fromEmail}`;
    await redis.set(key, String(replyId), { ex: REPLY_DEBOUNCE_SECONDS });
  }

  // Schedule deferred processing.
  await scheduleProcessing({ fromEmail, replyId, request });

  return NextResponse.json({ ok: true, replyId, attachmentsStored });
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

async function scheduleProcessing(opts: {
  fromEmail: string;
  replyId: number;
  request: NextRequest;
}) {
  const qstashToken = process.env.QSTASH_TOKEN;
  if (!qstashToken) {
    // No deferred-execution available; rely on cron sweep. Nothing to do.
    return;
  }
  const target = new URL(
    "/api/baby/internal/process-replies",
    opts.request.nextUrl.origin
  );
  try {
    await fetch(`https://qstash.upstash.io/v2/publish/${target.toString()}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${qstashToken}`,
        "Content-Type": "application/json",
        "Upstash-Delay": `${REPLY_DEBOUNCE_SECONDS}s`,
      },
      body: JSON.stringify({
        fromEmail: opts.fromEmail,
        triggerReplyId: opts.replyId,
      }),
    });
  } catch (err) {
    console.error("[baby-inbound] failed to schedule QStash job", err);
  }
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
