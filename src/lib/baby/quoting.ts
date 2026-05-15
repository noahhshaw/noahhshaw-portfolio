/**
 * Append the inbound message as a Gmail-style quoted block to the agent's
 * outgoing reply — for both the plain-text and HTML bodies.
 *
 * Gmail convention:
 *   Plain text:
 *     <agent prose>
 *
 *     On Thu, May 14, 2026 at 7:50 PM, Noah Shaw <noahhshaw@gmail.com> wrote:
 *     > line one of inbound
 *     > line two of inbound
 *     > ...
 *
 *   HTML:
 *     <p>agent paragraph 1</p>
 *     <p>agent paragraph 2</p>
 *     <div class="gmail_quote gmail_quote_container">
 *       <div dir="ltr" class="gmail_attr">On Thu, May 14, ... wrote:<br></div>
 *       <blockquote class="gmail_quote" style="margin:0 0 0 0.8ex;border-left:1px solid #ccc;padding-left:1ex">
 *         <inbound bodyHtml here>
 *       </blockquote>
 *     </div>
 *
 * Because the inbound bodyHtml itself usually already contains the parent's
 * own quote block, we get correctly-nested conversation history "for free"
 * — same way Gmail does it.
 *
 * Date is formatted in America/Los_Angeles (both parents are in SF). If
 * the family relocates, swap the constant below.
 */

const QUOTE_TZ = "America/Los_Angeles";

export type QuoteSource = {
  fromEmail: string;
  fromName?: string | null;
  receivedAt: Date;
  bodyText: string | null;
  bodyHtml: string | null;
};

export function formatAttributionDate(date: Date): string {
  // Targets "Thu, May 14, 2026 at 7:50 PM" — Gmail's canonical attribution
  // form. Intl.DateTimeFormat with these options produces exactly that on
  // Node 18+ (using "en-US" + dayPeriod-aware hour formatting).
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: QUOTE_TZ,
  })
    .format(date)
    // Some ICU builds emit "Thu, May 14, 2026, 7:50 PM" — replace the
    // last comma before the time with " at" so it matches Gmail style.
    .replace(/, (\d{1,2}:\d{2}\s?(AM|PM))$/i, " at $1");
}

export function buildAttributionLine(src: QuoteSource): string {
  const date = formatAttributionDate(src.receivedAt);
  const who = src.fromName
    ? `${src.fromName} <${src.fromEmail}>`
    : `<${src.fromEmail}>`;
  return `On ${date}, ${who} wrote:`;
}

/**
 * Plain-text quote: every line of the inbound body is prefixed with "> ".
 * If a line is already quoted (already starts with ">"), it gets another
 * level of ">" — matching how plain-text email clients render nested
 * threads.
 */
export function quoteBodyText(body: string): string {
  return body
    .split(/\r?\n/)
    .map((line) => (line.length === 0 ? ">" : `> ${line}`))
    .join("\n");
}

export function buildPlainTextWithQuote(
  agentText: string,
  src: QuoteSource
): string {
  const inbound = src.bodyText ?? "(no plain-text body)";
  const attribution = buildAttributionLine(src);
  // One blank line between agent body and attribution; attribution
  // followed by the quoted inbound. Matches Gmail's text-mode output.
  return `${agentText.trimEnd()}\n\n${attribution}\n${quoteBodyText(inbound)}\n`;
}

const QUOTE_HTML_OPEN = `<div class="gmail_quote gmail_quote_container">`;
const QUOTE_HTML_CLOSE = `</blockquote></div>`;

function attributionHtml(line: string): string {
  // The colon at the end of the attribution gets stripped by Gmail when
  // re-rendering; the <br> after the attribution is intentional.
  return `<div dir="ltr" class="gmail_attr">${escapeHtml(line)}<br></div>`;
}

function blockquoteOpen(): string {
  return `<blockquote class="gmail_quote" style="margin:0px 0px 0px 0.8ex;border-left:1px solid rgb(204,204,204);padding-left:1ex">`;
}

export function buildHtmlWithQuote(
  agentHtml: string,
  src: QuoteSource
): string {
  const attribution = buildAttributionLine(src);
  const inboundHtml =
    src.bodyHtml ??
    (src.bodyText ? plainToHtmlParagraphs(src.bodyText) : "");
  return [
    agentHtml.trim(),
    QUOTE_HTML_OPEN,
    attributionHtml(attribution),
    blockquoteOpen(),
    inboundHtml,
    QUOTE_HTML_CLOSE,
  ].join("\n");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function plainToHtmlParagraphs(text: string): string {
  return text
    .split(/\n\s*\n/)
    .map((p) => `<p>${escapeHtml(p.trim()).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

/**
 * Extract the human-readable "From" name from raw header bag. Worker
 * stores headers lowercase. Header value looks like:
 *   "Noah Shaw <noahhshaw@gmail.com>"
 * or:
 *   "noahhshaw@gmail.com"
 * Returns null when only the email is present.
 */
export function extractFromName(rawHeaders: unknown): string | null {
  if (!rawHeaders || typeof rawHeaders !== "object") return null;
  // The header bag might be array-of-pairs OR object map.
  let fromValue: string | undefined;
  if (Array.isArray(rawHeaders)) {
    const entry = (rawHeaders as Array<{ name?: string; value?: string }>)
      .find((h) => h?.name?.toLowerCase() === "from");
    fromValue = entry?.value;
  } else {
    const obj = rawHeaders as Record<string, unknown>;
    const v = obj["from"] ?? obj["From"];
    if (typeof v === "string") fromValue = v;
  }
  if (!fromValue) return null;
  const m = /^([^<]+)<[^>]+>$/.exec(fromValue.trim());
  if (!m) return null;
  const name = m[1].trim().replace(/^["']|["']$/g, "").trim();
  return name || null;
}
