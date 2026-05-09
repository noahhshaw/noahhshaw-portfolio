import { db } from "@/db";
import { magicLinkTokens } from "@/db/schema";
import { eq, and, gt, isNull } from "drizzle-orm";
import { Resend } from "resend";
import {
  BABY_FROM_EMAIL,
  BABY_SESSION_COOKIE,
  MAGIC_LINK_TTL_SECONDS,
  SESSION_TTL_SECONDS,
  isWhitelistedParent,
} from "./constants";

function getResendClient(): Resend {
  return new Resend(process.env.RESEND_API_KEY);
}

function getSessionSecret(): Uint8Array {
  const secret = process.env.BABY_SESSION_SECRET;
  if (!secret) {
    throw new Error("BABY_SESSION_SECRET is not set");
  }
  return new TextEncoder().encode(secret);
}

async function hmac(input: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    getSessionSecret() as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(input)
  );
  return base64url(new Uint8Array(sig));
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

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function randomToken(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return base64url(buf);
}

export type AuthRequestResult =
  | { ok: true }
  | { ok: false; reason: "not-whitelisted" | "send-failed" };

export async function requestMagicLink(
  email: string,
  origin: string
): Promise<AuthRequestResult> {
  const normalized = email.toLowerCase().trim();
  if (!isWhitelistedParent(normalized)) {
    return { ok: false, reason: "not-whitelisted" };
  }

  const token = randomToken(32);
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_SECONDS * 1000);

  await db.insert(magicLinkTokens).values({
    email: normalized,
    tokenHash,
    expiresAt,
  });

  const link = `${origin}/api/baby/auth/verify?token=${encodeURIComponent(token)}`;

  try {
    await getResendClient().emails.send({
      from: BABY_FROM_EMAIL,
      to: normalized,
      subject: "Your Daily Baby login link",
      text: `Your login link (valid 15 minutes):\n\n${link}\n\nIf you did not request this, ignore this email.`,
      html: `<p>Your login link (valid 15 minutes):</p><p><a href="${link}">${link}</a></p><p>If you did not request this, ignore this email.</p>`,
    });
  } catch (err) {
    console.error("[baby-auth] failed to send magic link", err);
    return { ok: false, reason: "send-failed" };
  }

  return { ok: true };
}

export type VerifyResult =
  | { ok: true; email: string; cookie: string }
  | { ok: false; reason: "invalid" | "expired" | "used" | "not-whitelisted" };

export async function verifyMagicLink(token: string): Promise<VerifyResult> {
  const tokenHash = await sha256Hex(token);
  const rows = await db
    .select()
    .from(magicLinkTokens)
    .where(eq(magicLinkTokens.tokenHash, tokenHash))
    .limit(1);

  const row = rows[0];
  if (!row) return { ok: false, reason: "invalid" };
  if (row.usedAt) return { ok: false, reason: "used" };
  if (row.expiresAt.getTime() < Date.now())
    return { ok: false, reason: "expired" };
  if (!isWhitelistedParent(row.email))
    return { ok: false, reason: "not-whitelisted" };

  await db
    .update(magicLinkTokens)
    .set({ usedAt: new Date() })
    .where(eq(magicLinkTokens.id, row.id));

  const cookie = await issueSessionCookie(row.email);
  return { ok: true, email: row.email, cookie };
}

// Session cookies are signed strings: "<email>.<expiresAtSeconds>.<sig>"
export async function issueSessionCookie(email: string): Promise<string> {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = `${email}.${expiresAt}`;
  const sig = await hmac(payload);
  return `${payload}.${sig}`;
}

export async function readSessionCookie(
  cookie: string | undefined
): Promise<{ email: string } | null> {
  if (!cookie) return null;
  // Parse from the right: the signature and expiry are dot-free, but the
  // email contains a `.` (e.g., gmail.com) so a left-split on `.` would
  // incorrectly fragment it.
  const lastDot = cookie.lastIndexOf(".");
  if (lastDot < 0) return null;
  const sig = cookie.slice(lastDot + 1);
  const rest = cookie.slice(0, lastDot);
  const secondLastDot = rest.lastIndexOf(".");
  if (secondLastDot < 0) return null;
  const expiresAtStr = rest.slice(secondLastDot + 1);
  const email = rest.slice(0, secondLastDot);
  if (!email || !sig || !expiresAtStr) return null;
  const expected = await hmac(`${email}.${expiresAtStr}`);
  if (sig !== expected) return null;
  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt)) return null;
  if (expiresAt * 1000 < Date.now()) return null;
  if (!isWhitelistedParent(email)) return null;
  return { email };
}

export const SESSION_COOKIE_NAME = BABY_SESSION_COOKIE;

export async function purgeExpiredMagicLinks(): Promise<number> {
  const result = await db
    .delete(magicLinkTokens)
    .where(
      and(
        // expired more than a day ago, OR used and older than a day
        gt(magicLinkTokens.expiresAt, new Date(0)),
        isNull(magicLinkTokens.usedAt)
      )
    );
  return (result as unknown as { rowCount?: number }).rowCount ?? 0;
}
