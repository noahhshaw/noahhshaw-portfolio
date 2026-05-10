// Validation rules for pre-computed daily emails.
// Source of truth: baby-kb/voice.md.
//
// Each validator returns a list of issue strings. The renderer/script can
// gate on `issues.length === 0` for auto-approval thresholds, or surface
// them in the review UI.

export type EmailToValidate = {
  ageInDays: number;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  citations: string[];
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

const REQUIRED_SECTIONS = ["Action items", "Watch-fors", "Source"];

const SUBJECT_PREFIX = (age: number) => `Day ${age}:`;
const MAX_SUBJECT_LENGTH = 72;
const MIN_WORD_COUNT = 200; // slight headroom under voice spec's 250
const MAX_WORD_COUNT = 600; // slight headroom over voice spec's 500

export function validateEmail(email: EmailToValidate): string[] {
  const issues: string[] = [];

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

  // Word count
  const words = email.bodyText.trim().split(/\s+/).filter(Boolean);
  if (words.length < MIN_WORD_COUNT) {
    issues.push(`body too short: ${words.length} words (min ${MIN_WORD_COUNT})`);
  }
  if (words.length > MAX_WORD_COUNT) {
    issues.push(`body too long: ${words.length} words (max ${MAX_WORD_COUNT})`);
  }

  // Banned register
  const haystack = email.bodyText.toLowerCase();
  for (const phrase of BANNED_PHRASES) {
    if (haystack.includes(phrase)) {
      issues.push(`banned phrase in body: "${phrase}"`);
    }
  }

  // Emoji in body
  if (/[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}]/u.test(email.bodyText)) {
    issues.push("body contains emoji");
  }

  // Exclamation points: allowed only in `[call now]` lines (per voice.md
  // exception). Approximate: any `!` not on the same line as `[call now]`
  // is flagged.
  const lines = email.bodyText.split("\n");
  for (const line of lines) {
    if (line.includes("!") && !line.includes("[call now]")) {
      issues.push(`exclamation outside [call now] context: "${line.trim().slice(0, 80)}"`);
      break; // one report is enough
    }
  }

  // Required sections
  for (const section of REQUIRED_SECTIONS) {
    if (!email.bodyText.includes(section)) {
      issues.push(`missing section: ${section}`);
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

  // Privacy: outgoing email must not contain anything that looks like
  // verbatim parent context. We can't fully detect this without runtime
  // context, but we can check for likely tells.
  const privacyTells = [
    "you mentioned",
    "as you noted",
    "you told us",
    "you wrote",
    "you said earlier",
    "in your reply",
  ];
  for (const tell of privacyTells) {
    if (haystack.includes(tell)) {
      issues.push(`privacy tell — likely echoes parent context: "${tell}"`);
    }
  }

  // Placeholder for the upcoming-events overlay must be present in both
  // text and html, otherwise the calendar can't be applied at send time.
  if (!email.bodyText.includes("{{UPCOMING_TEXT}}")) {
    issues.push("body_text missing {{UPCOMING_TEXT}} placeholder");
  }
  if (!email.bodyHtml.includes("{{UPCOMING_HTML}}")) {
    issues.push("body_html missing {{UPCOMING_HTML}} placeholder");
  }

  return issues;
}
