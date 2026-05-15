/**
 * Sanitize and validate agent-drafted reply bodies.
 *
 * Product rules (from 2026-05-14 review):
 *   - Plain-text body MUST read as natural prose in paragraphs. No
 *     markdown bold (`**x**`), italic (`*x*`, `_x_`), horizontal rules
 *     (`---`), code fences, or leading list markers (`- `, `1. `).
 *   - HTML body MUST use `<p>` paragraphs and hyperlinks as
 *     `<a href="URL">human-readable anchor text</a>`. Bare URLs as
 *     visible link text are flagged.
 *
 * cleanReplyText: best-effort markdown stripper. Idempotent. Safe to run
 * on already-clean text.
 *
 * cleanReplyHtml: paragraph-wraps text-mode replies and converts plain
 * URLs to `<a>` tags with the original anchor text when the model
 * forgot. Idempotent — doesn't double-wrap.
 *
 * validateReplyText / validateReplyHtml: structured complaints used for
 * tests and for runtime logging. Non-fatal — we still send the cleaned
 * version, but log the violations so the prompt can be tightened.
 */

export type ValidationResult = {
  ok: boolean;
  violations: string[];
};

const RAW_MD_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: "markdown-bold", re: /\*\*[^*\n]+\*\*/ },
  { name: "markdown-italic-asterisk", re: /(^|\s)\*[^*\n]+\*(\s|$)/m },
  { name: "markdown-italic-underscore", re: /(^|\s)_[^_\n]+_(\s|$)/m },
  { name: "horizontal-rule", re: /^\s*---+\s*$/m },
  { name: "code-fence", re: /```/ },
  { name: "leading-dash-list", re: /^\s*-\s+/m },
  { name: "leading-num-list", re: /^\s*\d+[.)]\s+/m },
  { name: "backtick-inline", re: /`[^`\n]+`/ },
];

export function validateReplyText(text: string): ValidationResult {
  const violations: string[] = [];
  for (const { name, re } of RAW_MD_PATTERNS) {
    if (re.test(text)) violations.push(name);
  }
  return { ok: violations.length === 0, violations };
}

/**
 * Strip markdown decoration from text. Preserves paragraph structure
 * (double-newline boundaries). Idempotent.
 */
export function cleanReplyText(input: string): string {
  let s = input;

  // Bold `**x**` → `x`
  s = s.replace(/\*\*([^*\n]+)\*\*/g, "$1");
  // Italic `*x*` → `x` and `_x_` → `x` (only when surrounded by whitespace
  // so we don't break legitimate underscores inside URLs/identifiers).
  s = s.replace(/(^|\s)\*([^*\n]+)\*(?=\s|[.,;:!?)]|$)/g, "$1$2");
  s = s.replace(/(^|\s)_([^_\n]+)_(?=\s|[.,;:!?)]|$)/g, "$1$2");

  // Inline backticks → bare text
  s = s.replace(/`([^`\n]+)`/g, "$1");

  // Code fences ``` … ``` → drop the fences, keep content
  s = s.replace(/```[a-zA-Z0-9_-]*\n?/g, "");

  // Horizontal rules → blank line
  s = s.replace(/^\s*---+\s*$/gm, "");

  // Leading list markers — convert "- foo" → "foo" and "1. foo" → "foo"
  // (this turns lists into prose; users explicitly asked for paragraphs).
  s = s.replace(/^[ \t]*[-*+][ \t]+/gm, "");
  s = s.replace(/^[ \t]*\d+[.)][ \t]+/gm, "");

  // Collapse runs of >2 blank lines to exactly two
  s = s.replace(/\n{3,}/g, "\n\n");

  return s.trim();
}

/**
 * Light HTML sanitizer + auto-link pass.
 *
 *   - If `text/html` was passed, leave the tags alone but check for raw
 *     markdown bleed-through.
 *   - If no HTML tags are present, paragraph-wrap on blank-line
 *     boundaries and auto-link bare URLs.
 *
 * The anchor text for auto-linked URLs is the URL's host + first path
 * segment (a readable substring), not the full URL. This implements the
 * "hyperlinked text, not raw URL" rule.
 */
export function cleanReplyHtml(input: string, cleanText?: string): string {
  const hasTags = /<[a-z][^>]*>/i.test(input);
  if (hasTags) {
    // Pass through, but make sure markdown didn't leak in.
    let s = input;
    s = s.replace(/\*\*([^*<]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/`([^`<\n]+)`/g, "$1");
    return s;
  }

  // Paragraph-wrap from plain text and auto-link bare URLs.
  const source = cleanText ?? input;
  const paragraphs = source
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const wrapped = paragraphs
    .map((p) => `<p style="margin:0 0 14px">${escapeHtml(p)}</p>`)
    .join("\n");

  return autoLink(wrapped);
}

/**
 * Validate that the HTML body uses anchored links for any URLs that
 * appear visibly in the text. We treat a "bare URL as visible anchor
 * text" as a violation — that's the bug the 2026-05-14 review caught.
 */
export function validateReplyHtml(html: string): ValidationResult {
  const violations: string[] = [];

  // Raw markdown leaked into the HTML.
  if (/\*\*[^*<\n]+\*\*/.test(html)) violations.push("markdown-bold-in-html");
  if (/^\s*---+\s*$/m.test(html)) violations.push("horizontal-rule-in-html");

  // Anchors whose visible text is identical to the href.
  const anchorRe = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = anchorRe.exec(html)) !== null) {
    const href = m[1].trim();
    const inner = m[2].replace(/<[^>]+>/g, "").trim();
    if (inner === href) violations.push("anchor-text-equals-href");
  }

  // Bare URLs in visible text (outside of href attributes).
  const stripped = html.replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, "");
  if (/https?:\/\/[^\s<]+/.test(stripped)) violations.push("bare-url-in-body");

  return { ok: violations.length === 0, violations };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Auto-link bare URLs in HTML. Skips URLs that are already inside an
 * anchor. Uses a humanized anchor: host name (without "www."), so the
 * visible text reads like "healthychildren.org" instead of the full URL.
 */
function autoLink(html: string): string {
  return html.replace(
    /(<a\b[^>]*>[\s\S]*?<\/a>)|(https?:\/\/[^\s<()]+)/gi,
    (_match, anchor, url) => {
      if (anchor) return anchor;
      const clean = (url as string).replace(/[.,;:!?)]+$/, "");
      const trailing = (url as string).slice(clean.length);
      let host = "";
      try {
        host = new URL(clean).hostname.replace(/^www\./, "");
      } catch {
        host = clean;
      }
      return `<a href="${clean}" style="color:#1d4ed8">${host}</a>${trailing}`;
    }
  );
}
