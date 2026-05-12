export const BABY_PARENTS = {
  noah: {
    email: "noahhshaw@gmail.com",
    firstName: "Noah",
    role: "primary" as const,
  },
  anoushka: {
    email: "vaswani.anoushka@gmail.com",
    firstName: "Anoushka",
    role: "partner" as const,
  },
} as const;

export const BABY_PARENT_EMAILS: readonly string[] = [
  BABY_PARENTS.noah.email,
  BABY_PARENTS.anoushka.email,
];

export const BABY_FROM_EMAIL = "Daily Baby <daily-baby@noahhshaw.com>";
export const BABY_REPLY_TO_EMAIL = "daily-baby@noahhshaw.com";

// 7am Pacific. Vercel cron runs in UTC.
// PST = UTC-8, PDT = UTC-7. Cron expression `0 14 * * *` is 6am PST / 7am PDT.
// `0 15 * * *` is 7am PST / 8am PDT.
// We schedule TWO cron entries to handle DST: see vercel.json.
export const SEND_HOUR_LOCAL = 7;
export const SEND_TIMEZONE = "America/Los_Angeles";

// Reply debounce window: incoming replies wait this long before processing,
// so rapid-fire replies are batched into one agent invocation.
export const REPLY_DEBOUNCE_SECONDS = 600; // 10 minutes

// Magic link tokens expire in 15 minutes.
export const MAGIC_LINK_TTL_SECONDS = 15 * 60;

// Session cookies live 30 days.
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

export const BABY_SESSION_COOKIE = "baby_session";

export function isWhitelistedParent(email: string): boolean {
  return BABY_PARENT_EMAILS.includes(email.toLowerCase().trim());
}

export function parentByEmail(email: string) {
  const normalized = email.toLowerCase().trim();
  return Object.values(BABY_PARENTS).find((p) => p.email === normalized);
}
