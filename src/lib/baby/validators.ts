// Validation rules for pre-computed daily emails.
// Source of truth: baby-kb/voice.md.
//
// Two layers:
//   1. `validateEmail()` — pure content checks (sync, no network).
//   2. `checkLinks()`   — async HEAD probes on every URL.
//
// The generation pipeline runs both. If either reports issues, the agent
// re-drafts with the issues as feedback. Production never re-validates;
// artifacts are immutable once committed.

export type EmailToValidate = {
  ageInDays: number;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  citations: string[];
  /**
   * Whether at least one milestone is surface-eligible at this age (any
   * catalog row with age_window_low_days <= ageInDays). The validator
   * uses this to require the "Developmental milestone check-in" section
   * is present (and absent when it shouldn't be). The caller computes
   * this from the on-disk catalog so the validator stays sync + DB-free.
   * If unspecified, the milestone-section check is skipped (back-compat).
   */
  milestonesExpected?: boolean;
};

const BANNED_PHRASES = [
  "snuggle",
  "snuggly",
  "precious",
  "little one",
  "wee one",
  "blessing",
  "miracle",
  "mama bear",
  "mama tribe",
  "tribe of",
  "village",
  "trust your instincts",
  "every baby is different",
  "self-care",
  "honor your feelings",
  "magical",
  "sweet baby",
  "precious one",
  "birthing person",
  "chestfeeding",
  "attune to",
  "co-regulate",
  "honor the child's experience",
];

// Canonical-name misspellings the validator flags as hard errors. Match is
// case-insensitive with word boundaries (so "Anushka's", "ANUSHKA" all flag,
// but "Anoushka" passes).
const BANNED_NAME_REGEXES: Array<{ pattern: RegExp; canonical: string }> = [
  { pattern: /\bAnushka\b/i, canonical: "Anoushka" },
];

const REQUIRED_SECTIONS = [
  "Action items",
  "Watch-fors",
  "Enrichment opportunities",
];

// Enrichment opportunities must be a bullet list of 3-5 items.
const ENRICHMENT_MIN = 3;
const ENRICHMENT_MAX = 5;

const BULLET_RE = /^\s*[-*•]\s+/;

const SUBJECT_PREFIX = (age: number) => `Day ${age}:`;
const MAX_SUBJECT_LENGTH = 72;
const MIN_WORD_COUNT = 200; // slight headroom under voice spec's 250
const MAX_WORD_COUNT = 600; // slight headroom over voice spec's 500
// The milestone check-in section is mechanically rendered (not gen-agent
// prose) and exempt from prose-quality constraints — banned-phrase scan,
// word count, exclamation count, "Further reading" structure. We strip
// the section before applying those checks.
const MILESTONE_SECTION_HEADER = "Developmental milestone check-in";

function stripMilestoneSection(text: string): string {
  const idx = text.indexOf(MILESTONE_SECTION_HEADER);
  if (idx < 0) return text;
  return text.slice(0, idx).trimEnd();
}

export function validateEmail(email: EmailToValidate): string[] {
  const issues: string[] = [];
  // Strip the appended milestone section from the prose-quality checks —
  // it's mechanically rendered with fixed-format clinical notes that
  // intentionally use vocabulary the gen-agent voice rules would flag.
  const proseText = stripMilestoneSection(email.bodyText);

  // Subject format
  if (!email.subject.startsWith(SUBJECT_PREFIX(email.ageInDays))) {
    issues.push(
      `subject must start with "Day ${email.ageInDays}:" — got "${email.subject.slice(0, 30)}…"`
    );
  }
  if (email.subject.length > MAX_SUBJECT_LENGTH) {
    issues.push(
      `subject too long: ${email.subject.length} chars (max ${MAX_SUBJECT_LENGTH})`
    );
  }
  if (/[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}]/u.test(email.subject)) {
    issues.push("subject contains emoji");
  }
  if (email.subject.includes("!")) {
    issues.push("subject contains exclamation point");
  }

  // Word count (prose only, milestone section excluded)
  const words = proseText.trim().split(/\s+/).filter(Boolean);
  if (words.length < MIN_WORD_COUNT) {
    issues.push(`body too short: ${words.length} words (min ${MIN_WORD_COUNT})`);
  }
  if (words.length > MAX_WORD_COUNT) {
    issues.push(`body too long: ${words.length} words (max ${MAX_WORD_COUNT})`);
  }

  // Banned register (prose only)
  const haystack = proseText.toLowerCase();
  for (const phrase of BANNED_PHRASES) {
    if (haystack.includes(phrase)) {
      issues.push(`banned phrase in body: "${phrase}"`);
    }
  }

  // Banned canonical-name misspellings (e.g., Anushka → Anoushka).
  // Applied to full body — even the milestone section must spell names
  // correctly if any future catalog item references a parent.
  for (const { pattern, canonical } of BANNED_NAME_REGEXES) {
    if (pattern.test(email.bodyText) || pattern.test(email.subject)) {
      issues.push(
        `canonical-name misspelling: pattern ${pattern} found; correct spelling is "${canonical}"`
      );
    }
  }

  // KB file paths leak into body — internal metadata never goes to readers.
  // Applied to full body.
  if (/baby-kb\//.test(email.bodyText) || /baby-kb\//.test(email.bodyHtml)) {
    issues.push(
      "body contains 'baby-kb/' file path — KB paths are internal metadata; use external authority URLs in the body"
    );
  }

  // Emoji in body — applied to full body.
  if (/[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}]/u.test(email.bodyText)) {
    issues.push("body contains emoji");
  }

  // Exclamation points: allowed only in `[call now]` lines (per voice.md
  // exception). Prose only — milestone section is exempt because some
  // clinical-note text needs naturalistic punctuation.
  const lines = proseText.split("\n");
  for (const line of lines) {
    if (line.includes("!") && !line.includes("[call now]")) {
      issues.push(
        `exclamation outside [call now] context: "${line.trim().slice(0, 80)}"`
      );
      break;
    }
  }

  // Required sections (prose only — the gen-agent must still author all
  // canonical sections; milestone section is a non-gen-agent addition).
  for (const section of REQUIRED_SECTIONS) {
    if (!proseText.includes(section)) {
      issues.push(`missing section: ${section}`);
    }
  }

  // Milestone check-in presence. The 2026-05-21 incident — three days
  // of emails went out without the section because a regen wrote fresh
  // JSON and the bake step was skipped — should never recur silently.
  if (email.milestonesExpected === true) {
    if (!email.bodyText.includes(MILESTONE_SECTION_HEADER)) {
      issues.push(
        `missing milestone section in bodyText — at least one catalog row is eligible at age ${email.ageInDays}; run 'npm run milestones:bake -- --days=${email.ageInDays}'`
      );
    }
    if (!email.bodyHtml.includes(MILESTONE_SECTION_HEADER)) {
      issues.push(
        `missing milestone section in bodyHtml — at least one catalog row is eligible at age ${email.ageInDays}; run 'npm run milestones:bake -- --days=${email.ageInDays}'`
      );
    }
  } else if (email.milestonesExpected === false) {
    if (
      email.bodyText.includes(MILESTONE_SECTION_HEADER) ||
      email.bodyHtml.includes(MILESTONE_SECTION_HEADER)
    ) {
      issues.push(
        `milestone section present but no catalog row is eligible at age ${email.ageInDays} — stale bake; regenerate`
      );
    }
  }

  // "Enrichment opportunities" must be a bullet list of 3-5 items.
  const enrichBlock = extractSection(proseText, "Enrichment opportunities");
  if (enrichBlock !== null) {
    const bulletLines = enrichBlock
      .split("\n")
      .filter((l) => BULLET_RE.test(l));
    if (bulletLines.length < ENRICHMENT_MIN) {
      issues.push(
        `Enrichment opportunities must have at least ${ENRICHMENT_MIN} bullet items; found ${bulletLines.length}`
      );
    }
    if (bulletLines.length > ENRICHMENT_MAX) {
      issues.push(
        `Enrichment opportunities must have at most ${ENRICHMENT_MAX} bullet items; found ${bulletLines.length}`
      );
    }
  }

  // Citations
  if (!email.citations || email.citations.length === 0) {
    issues.push("no citations supplied");
  } else {
    for (const c of email.citations) {
      if (!c.startsWith("baby-kb/")) {
        issues.push(`citation does not point at baby-kb/: "${c}"`);
        break;
      }
    }
  }

  return issues;
}

// Pull the body of a named section out of the plain-text email. Returns
// everything from the heading line until the next blank-line-followed-by-
// another-heading, or end of text.
function extractSection(bodyText: string, heading: string): string | null {
  const idx = bodyText.indexOf(heading);
  if (idx < 0) return null;
  const after = bodyText.slice(idx + heading.length);
  // Find the next "header line" — a non-empty line that's followed by content
  // and matches one of the known section headings.
  const otherHeadings = [
    "Today's focus",
    "Action items",
    "Watch-fors",
    "Enrichment opportunities",
    "Upcoming",
    "Developmental milestone check-in",
  ].filter((h) => h !== heading);
  const lines = after.split("\n");
  const collected: string[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (otherHeadings.some((h) => line.trim() === h)) break;
    collected.push(line);
  }
  return collected.join("\n");
}

// Extract HTTP(S) URLs from a text body or html body.
export function extractUrls(text: string): string[] {
  const urls = new Set<string>();
  const re = /https?:\/\/[^\s<>"')\]]+/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    // strip trailing punctuation
    urls.add(m[0].replace(/[.,;:!?)\]]+$/, ""));
  }
  return Array.from(urls);
}

export type LinkCheckResult = {
  url: string;
  ok: boolean;
  status?: number;
  error?: string;
};

// Probe every URL in the body with HEAD (fallback to GET if HEAD is
// rejected) and report which ones don't resolve.
export async function checkLinks(
  email: EmailToValidate,
  opts: { concurrency?: number; timeoutMs?: number } = {}
): Promise<LinkCheckResult[]> {
  const urls = Array.from(
    new Set([...extractUrls(email.bodyText), ...extractUrls(email.bodyHtml)])
  );
  const concurrency = opts.concurrency ?? 5;
  const timeoutMs = opts.timeoutMs ?? 8000;

  const results: LinkCheckResult[] = [];
  const queue = [...urls];
  async function worker() {
    while (queue.length > 0) {
      const url = queue.shift();
      if (!url) return;
      results.push(await probe(url, timeoutMs));
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, urls.length) }, () => worker())
  );
  return results;
}

// Many authority sites (AAP, SagePub, etc.) reject non-browser user-agents
// with 403, even though humans can reach the page fine. Send a realistic UA
// to avoid false positives.
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const BROWSER_ACCEPT =
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8";

async function probe(url: string, timeoutMs: number): Promise<LinkCheckResult> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const headers = {
    "User-Agent": BROWSER_UA,
    Accept: BROWSER_ACCEPT,
    "Accept-Language": "en-US,en;q=0.9",
  };
  try {
    let res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      headers,
      signal: ctrl.signal,
    });
    // Many servers 405/403 on HEAD even with a browser UA. Retry with GET.
    if (!res.ok && (res.status === 405 || res.status === 403)) {
      res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        headers,
        signal: ctrl.signal,
      });
    }
    return { url, ok: res.ok, status: res.status };
  } catch (err) {
    return {
      url,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(t);
  }
}

// Aggregate a content + links check into a single issues[] list.
export async function validateEmailAndLinks(
  email: EmailToValidate
): Promise<{ contentIssues: string[]; linkIssues: string[] }> {
  const contentIssues = validateEmail(email);
  const linkResults = await checkLinks(email);
  const linkIssues = linkResults
    .filter((r) => !r.ok)
    .map(
      (r) =>
        `link broken: ${r.url} → ${r.status ? `HTTP ${r.status}` : r.error}`
    );
  return { contentIssues, linkIssues };
}
