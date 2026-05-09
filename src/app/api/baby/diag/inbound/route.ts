import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Temporary diagnostic for debugging the Cloudflare ↔ Vercel HMAC handshake.
// Returns one-way hashes only — never the secret itself.
//
// Remove this route once /api/inbound/baby is verified working in production.

export async function GET() {
  const secret = process.env.INBOUND_WEBHOOK_SECRET ?? "";
  const len = secret.length;
  const hash = await sha256Hex(secret);

  return NextResponse.json({
    secret_present: len > 0,
    secret_length: len,
    secret_hash_prefix: hash.slice(0, 12),
    // For comparing with the Cloudflare side, we hash a fixed test string too.
    // Both sides should produce identical output for "test123".
    test_hash: await hmacHex(secret, "test123"),
    deployment_id:
      process.env.VERCEL_DEPLOYMENT_ID ??
      process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ??
      "unknown",
    deployment_url: process.env.VERCEL_URL ?? "unknown",
    deployed_at: process.env.VERCEL_GIT_COMMIT_AUTHOR_LOGIN
      ? new Date().toISOString()
      : "unknown",
  });
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacHex(secret: string, input: string): Promise<string> {
  if (!secret) return "no-secret";
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
