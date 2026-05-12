import { db } from "@/db";
import { agentSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { redis, isRedisConfigured } from "@/lib/redis";
import { BABY_PARENTS } from "./constants";

// The dashboard-editable recipient list. Backed by agent_settings.value
// (JSON) under key "recipients". Cached in Redis (60s TTL) since the list
// is read on every authenticated request but changes very rarely.

export type Recipient = {
  email: string;
  firstName: string;
  role: "primary" | "partner" | "guest";
  receivesDailyEmail: boolean;
};

const SETTING_KEY = "recipients";
const CACHE_KEY = "baby:recipients";
const CACHE_TTL_SECONDS = 60;

const DEFAULT_RECIPIENTS: Recipient[] = [
  {
    email: BABY_PARENTS.noah.email,
    firstName: BABY_PARENTS.noah.firstName,
    role: "primary",
    receivesDailyEmail: true,
  },
  {
    email: BABY_PARENTS.anoushka.email,
    firstName: BABY_PARENTS.anoushka.firstName,
    role: "partner",
    receivesDailyEmail: true,
  },
];

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function loadRecipients(): Promise<Recipient[]> {
  if (isRedisConfigured()) {
    try {
      const cached = (await redis.get(CACHE_KEY)) as Recipient[] | null;
      if (Array.isArray(cached) && cached.length > 0) return cached;
    } catch {
      // Cache miss is non-fatal.
    }
  }

  const rows = await db
    .select()
    .from(agentSettings)
    .where(eq(agentSettings.key, SETTING_KEY))
    .limit(1);

  let recipients: Recipient[];
  if (rows.length === 0) {
    // First read — seed with defaults.
    recipients = DEFAULT_RECIPIENTS;
    await db
      .insert(agentSettings)
      .values({
        key: SETTING_KEY,
        value: recipients,
      })
      .onConflictDoNothing();
  } else {
    const value = rows[0].value;
    if (Array.isArray(value) && value.length > 0) {
      recipients = (value as Recipient[]).map((r) => ({
        email: normalizeEmail(r.email),
        firstName: r.firstName ?? "",
        role: r.role ?? "guest",
        receivesDailyEmail: r.receivesDailyEmail ?? true,
      }));
    } else {
      recipients = DEFAULT_RECIPIENTS;
    }
  }

  if (isRedisConfigured()) {
    try {
      await redis.set(CACHE_KEY, recipients, { ex: CACHE_TTL_SECONDS });
    } catch {
      // ignore
    }
  }
  return recipients;
}

export async function saveRecipients(
  recipients: Recipient[],
  updatedByEmail: string | null
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (recipients.length === 0) {
    return { ok: false, reason: "at least one recipient required" };
  }
  // Validate
  const seen = new Set<string>();
  for (const r of recipients) {
    if (!isValidEmail(r.email)) {
      return { ok: false, reason: `invalid email: ${r.email}` };
    }
    const norm = normalizeEmail(r.email);
    if (seen.has(norm)) {
      return { ok: false, reason: `duplicate email: ${norm}` };
    }
    seen.add(norm);
    if (!r.firstName || r.firstName.length > 80) {
      return { ok: false, reason: `firstName required (≤80 chars): ${r.email}` };
    }
    if (!["primary", "partner", "guest"].includes(r.role)) {
      return { ok: false, reason: `invalid role: ${r.role}` };
    }
  }
  if (!recipients.some((r) => r.receivesDailyEmail)) {
    return {
      ok: false,
      reason: "at least one recipient must receive the daily email",
    };
  }

  const normalized = recipients.map((r) => ({
    email: normalizeEmail(r.email),
    firstName: r.firstName.trim(),
    role: r.role,
    receivesDailyEmail: !!r.receivesDailyEmail,
  }));

  await db
    .insert(agentSettings)
    .values({
      key: SETTING_KEY,
      value: normalized,
      updatedByEmail,
    })
    .onConflictDoUpdate({
      target: agentSettings.key,
      set: {
        value: normalized,
        updatedAt: new Date(),
        updatedByEmail,
      },
    });

  if (isRedisConfigured()) {
    try {
      await redis.del(CACHE_KEY);
    } catch {
      // ignore
    }
  }
  return { ok: true };
}

export async function isWhitelistedRecipient(email: string): Promise<boolean> {
  const norm = normalizeEmail(email);
  if (!norm) return false;
  const recipients = await loadRecipients();
  return recipients.some((r) => r.email === norm);
}

export async function getRecipientByEmail(
  email: string
): Promise<Recipient | undefined> {
  const norm = normalizeEmail(email);
  if (!norm) return undefined;
  const recipients = await loadRecipients();
  return recipients.find((r) => r.email === norm);
}

export async function getDailyEmailRecipients(): Promise<string[]> {
  const recipients = await loadRecipients();
  return recipients.filter((r) => r.receivesDailyEmail).map((r) => r.email);
}

export async function getAllRecipientEmails(): Promise<string[]> {
  const recipients = await loadRecipients();
  return recipients.map((r) => r.email);
}
