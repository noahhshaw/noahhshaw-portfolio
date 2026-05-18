/**
 * Daily-email renderer. Takes structured section content and produces the
 * { bodyText, bodyHtml } pair that gets written into a pre-computed
 * day-N.json artifact.
 *
 * This is the single source of truth for the email template. The gen
 * pipeline (Claude Code) authors the structured DailyContent; this module
 * renders it deterministically so HTML and text never drift.
 *
 * Section order (voice.md "Email structure"):
 *   1. Today's focus
 *   2. Action items
 *   3. Watch-fors
 *   4. Enrichment opportunities
 *   5. Upcoming
 * The "Developmental milestone check-in" block is appended separately by
 * the milestone bake step — NOT here.
 */

export type LinkedItem = {
  /** The sentence(s). May be plain prose. */
  body: string;
  /** Optional inline source. Rendered as "label: url" in text, anchored in HTML. */
  sourceLabel?: string;
  sourceUrl?: string;
};

export type DailyContent = {
  ageInDays: number;
  /** Short phrase after "Day N ·" in the HTML h1, e.g. "birth-weight crossing". */
  hook: string;
  /** 1-2 sentences. */
  todaysFocus: string;
  actionItems: LinkedItem[];
  /** Each begins with a severity tag, e.g. "[low concern] ...". */
  watchFors: string[];
  /** 3-5 items. */
  enrichment: LinkedItem[];
  /** Bare strings, each a "Day X-Y: ..." line. */
  upcoming: string[];
};

export type RenderedDaily = {
  bodyText: string;
  bodyHtml: string;
};

const SEVERITY_RE = /^\s*(\[[^\]]+\])\s*/;

function linkedItemText(item: LinkedItem): string {
  if (item.sourceLabel && item.sourceUrl) {
    return `${item.body} ${item.sourceLabel}: ${item.sourceUrl}`;
  }
  return item.body;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Linkify a linked item for HTML: anchor the label, keep the body as prose. */
function linkedItemHtml(item: LinkedItem): string {
  const body = escapeHtml(item.body);
  if (item.sourceLabel && item.sourceUrl) {
    return `${body} <a href="${item.sourceUrl}" style="color:#1d4ed8">${escapeHtml(item.sourceLabel)}</a>.`;
  }
  return body;
}

export function renderDaily(content: DailyContent): RenderedDaily {
  return {
    bodyText: renderText(content),
    bodyHtml: renderHtml(content),
  };
}

function renderText(c: DailyContent): string {
  const lines: string[] = [];
  lines.push("Today's focus");
  lines.push(c.todaysFocus);
  lines.push("");
  lines.push("Action items");
  for (const item of c.actionItems) lines.push(`- ${linkedItemText(item)}`);
  lines.push("");
  lines.push("Watch-fors");
  for (const w of c.watchFors) lines.push(`- ${w}`);
  lines.push("");
  lines.push("Enrichment opportunities");
  for (const item of c.enrichment) lines.push(`- ${linkedItemText(item)}`);
  lines.push("");
  lines.push("Upcoming");
  for (const u of c.upcoming) lines.push(`- ${u}`);
  return lines.join("\n");
}

const H2 =
  'style="font-size:13px;color:#111827;margin:22px 0 8px;text-transform:uppercase;letter-spacing:0.05em"';
const UL = 'style="margin:0;padding-left:20px"';

function watchForHtml(w: string): string {
  const m = SEVERITY_RE.exec(w);
  if (m) {
    const rest = escapeHtml(w.slice(m[0].length));
    return `<li><strong>${escapeHtml(m[1])}</strong> ${rest}</li>`;
  }
  return `<li>${escapeHtml(w)}</li>`;
}

function renderHtml(c: DailyContent): string {
  const actionItems = c.actionItems
    .map((i) => `<li>${linkedItemHtml(i)}</li>`)
    .join("");
  const watchFors = c.watchFors.map(watchForHtml).join("");
  const enrichment = c.enrichment
    .map((i) => `<li>${linkedItemHtml(i)}</li>`)
    .join("");
  const upcoming = c.upcoming
    .map((u) => `<li>${escapeHtml(u)}</li>`)
    .join("");

  return (
    `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px;color:#1f2937;line-height:1.55">` +
    `<div style="max-width:620px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:28px">` +
    `<p style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 4px">Daily Baby</p>` +
    `<h1 style="font-size:20px;color:#111827;margin:0 0 18px">Day ${c.ageInDays} &middot; ${escapeHtml(c.hook)}</h1>` +
    `<h2 ${H2}>Today's focus</h2>` +
    `<p style="margin:0">${escapeHtml(c.todaysFocus)}</p>` +
    `<h2 ${H2}>Action items</h2>` +
    `<ul ${UL}>${actionItems}</ul>` +
    `<h2 ${H2}>Watch-fors</h2>` +
    `<ul ${UL}>${watchFors}</ul>` +
    `<h2 ${H2}>Enrichment opportunities</h2>` +
    `<ul ${UL}>${enrichment}</ul>` +
    `<h2 ${H2}>Upcoming</h2>` +
    `<ul ${UL}>${upcoming}</ul>` +
    `</div></body></html>`
  );
}
