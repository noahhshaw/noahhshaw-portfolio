/**
 * Email-threading helpers for Gmail-compatible reply chains.
 *
 * Gmail (and most modern MUAs) thread by three signals, in order:
 *   1. References — full chain of ancestor Message-IDs
 *   2. In-Reply-To — the immediate parent Message-ID
 *   3. Subject — must match modulo a leading "Re: " prefix
 *
 * If ANY of those drift, Gmail splits the thread. The most common breakage
 * we hit is the agent writing a brand-new subject ("Re: cord stump care")
 * for a reply that should be threaded under "Day 4: jaundice peak day…".
 *
 * Rules implemented here:
 *   - Outgoing subject = inbound reply's subject (already "Re: <daily>"),
 *     verbatim. If for some reason it lacks "Re: ", we prepend it.
 *   - In-Reply-To = inbound reply's Message-ID, angle-bracketed.
 *   - References = "<daily-email-mid> <user-reply-mid>", angle-bracketed,
 *     space-separated. We chain backwards from the user's reply to the
 *     original daily email when both are known.
 */

export type ThreadHeaders = {
  Subject: string;
  "In-Reply-To": string;
  References: string;
};

export type ThreadingInput = {
  /** Subject of the user's inbound reply. May or may not start with "Re:". */
  inboundSubject: string | null;
  /** Message-ID of the user's inbound reply (RFC 5322 form, with or without brackets). */
  inboundMessageId: string | null;
  /** Message-ID of the original daily email this reply chain stems from. Optional. */
  originalDailyMessageId?: string | null;
  /** Subject of the original daily email. Used as a fallback if inbound subject is missing. */
  originalDailySubject?: string | null;
};

const RE_PREFIX = /^\s*re\s*:\s*/i;

/**
 * Build outgoing headers that Gmail will use to thread the response under
 * the same conversation as the inbound reply.
 */
export function buildThreadHeaders(input: ThreadingInput): ThreadHeaders {
  const subjectBase = (input.inboundSubject ?? input.originalDailySubject ?? "")
    .trim();
  const subject = subjectBase
    ? RE_PREFIX.test(subjectBase)
      ? subjectBase
      : `Re: ${subjectBase}`
    : "Re: (no subject)";

  const inReplyTo = angleBracket(input.inboundMessageId);
  const refs: string[] = [];
  const daily = angleBracket(input.originalDailyMessageId);
  if (daily) refs.push(daily);
  if (inReplyTo && inReplyTo !== daily) refs.push(inReplyTo);

  return {
    Subject: subject,
    "In-Reply-To": inReplyTo ?? "",
    References: refs.join(" "),
  };
}

/**
 * Wrap a Message-ID in angle brackets if it isn't already. Strips
 * surrounding whitespace and any stray quoting. Returns null if input
 * is null/empty.
 */
export function angleBracket(id: string | null | undefined): string | null {
  if (!id) return null;
  const cleaned = id.trim().replace(/^["']|["']$/g, "");
  if (!cleaned) return null;
  if (cleaned.startsWith("<") && cleaned.endsWith(">")) return cleaned;
  // Strip any partial brackets first.
  const inner = cleaned.replace(/^<+|>+$/g, "");
  if (!inner) return null;
  return `<${inner}>`;
}

/**
 * Normalize a subject to its canonical thread form: collapse multiple
 * "Re:" prefixes to a single one, trim whitespace. Pure utility — not
 * required by Gmail but useful for readability and tests.
 */
export function normalizeSubject(subject: string): string {
  let s = subject.trim();
  while (RE_PREFIX.test(s)) s = s.replace(RE_PREFIX, "");
  return s ? `Re: ${s}` : "Re: (no subject)";
}
