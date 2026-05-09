// Subject-line builder. Per voice.md:
//   `Day N: {most important info}` — ≤72 chars, no emoji, no exclamation.

export const SUBJECT_MAX_LENGTH = 72;

export function buildSubject(opts: {
  ageInDays: number;
  hook: string;
}): string {
  const ageLabel = `Day ${opts.ageInDays}`;
  const cleanHook = opts.hook
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[!\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/^./, (c) => c.toLowerCase())
    .trim();

  // Reserve room for "Day N: " prefix + 1 char of hook minimum.
  const prefixLength = `${ageLabel}: `.length;
  const remaining = SUBJECT_MAX_LENGTH - prefixLength;
  const truncated = cleanHook
    .slice(0, remaining)
    .replace(/[\s,;:.\-]+$/, "");

  if (!truncated) return ageLabel;
  return `${ageLabel}: ${truncated}`;
}
