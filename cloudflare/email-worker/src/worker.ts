import PostalMime from "postal-mime";

interface Env {
  INBOUND_WEBHOOK_URL: string;
  INBOUND_WEBHOOK_SECRET: string;
}

// Cloudflare Email Worker. Receives inbound mail to daily-baby@noahhshaw.com,
// parses MIME, and POSTs an HMAC-signed JSON envelope to the Vercel-hosted
// /api/inbound/baby endpoint.
//
// Routing is configured in the Cloudflare dashboard:
//   Email → Email Routing → Routing rules → custom address `daily-baby` →
//     Action: "Send to a Worker" → pick `baby-email-router`.

export default {
  async email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext) {
    const parser = new PostalMime();
    const raw = await new Response(message.raw).arrayBuffer();
    const parsed = await parser.parse(new Uint8Array(raw));

    const headersIndex: Record<string, string> = {};
    for (const h of parsed.headers ?? []) {
      headersIndex[h.key.toLowerCase()] = h.value;
    }

    const payload = {
      data: {
        from: parsed.from
          ? { email: parsed.from.address ?? message.from, name: parsed.from.name }
          : { email: message.from },
        to:
          parsed.to?.map((t) => ({ email: t.address, name: t.name })) ??
          (message.to ? [{ email: message.to }] : []),
        cc: parsed.cc?.map((t) => ({ email: t.address, name: t.name })) ?? [],
        subject: parsed.subject ?? null,
        text: parsed.text ?? null,
        html: parsed.html ?? null,
        in_reply_to:
          headersIndex["in-reply-to"] ?? parsed.inReplyTo ?? null,
        message_id: parsed.messageId ?? headersIndex["message-id"] ?? null,
        headers: headersIndex,
        attachments: (parsed.attachments ?? []).map((att) => {
          const bytes = attachmentToBytes(att.content);
          return {
            filename: att.filename ?? "attachment",
            content_type: att.mimeType ?? "application/octet-stream",
            size: bytes.byteLength,
            content: uint8ToBase64(bytes),
          };
        }),
      },
    };

    const body = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = await hmacHex(
      env.INBOUND_WEBHOOK_SECRET,
      `${timestamp}.${body}`
    );

    const res = await fetch(env.INBOUND_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-inbound-source": "cloudflare-email",
        "x-inbound-timestamp": timestamp,
        "x-inbound-signature": signature,
      },
      body,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(
        `[email-worker] webhook returned ${res.status}: ${text.slice(0, 500)}`
      );
      // Don't reject the email — we don't want Cloudflare to retry forever
      // or bounce. Better to drop and log; we can replay manually if needed.
    }
  },
} satisfies ExportedHandler<Env>;

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

function attachmentToBytes(
  c: string | ArrayBuffer | Uint8Array
): Uint8Array {
  if (typeof c === "string") {
    // postal-mime returns base64 strings for some attachment types.
    const bin = atob(c);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  if (c instanceof Uint8Array) return c;
  return new Uint8Array(c);
}

function uint8ToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin);
}
