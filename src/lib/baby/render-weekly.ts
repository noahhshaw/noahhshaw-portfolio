/**
 * Weekly-email renderer (day 89 / week 13 onward). Takes structured section
 * content and produces the { bodyText, bodyHtml } pair for a pre-computed
 * day-N.json artifact, where N is the Saturday ageInDays.
 *
 * Mirrors render-daily.ts so HTML and text never drift, with the weekly
 * structure (voice.md "Email structure — weekly era"):
 *   1. This week
 *   2. Watch-fors this week
 *   3. Enrichment opportunities   (single merged section: at-home practice
 *                                  AND pipeline moves with lead times)
 *   4. Upcoming                   (absorbs dated medical/admin entries —
 *                                  there is no Action items section)
 * The "Developmental milestone check-in" block is appended separately by
 * the milestone bake step — NOT here.
 */

import type { LinkedItem } from "@/lib/baby/render-daily";

export type WeeklyContent = {
  /** The Saturday's age in days (artifact key). */
  ageInDays: number;
  /** 1-based week of life; week = floor(ageInDays / 7) + 1. */
  week: number;
  /** Short phrase after "Week N ·" in the HTML h1. */
  hook: string;
  /** 2-3 sentences: what develops across days N..N+6. */
  thisWeek: string;
  /** Each begins with a severity tag, e.g. "[low concern] ...". */
  watchFors: string[];
  /** 3-5 items, practice and pipeline moves mixed. */
  enrichment: LinkedItem[];
  /** Bare strings, each a dated "Day X-Y (…): ..." line. */
  upcoming: string[];
};

export type RenderedWeekly = {
  bodyText: string;
  bodyHtml: string;
};

export function weekOf(ageInDays: number): number {
  return Math.floor(ageInDays / 7) + 1;
}

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

function linkedItemHtml(item: LinkedItem): string {
  const body = escapeHtml(item.body);
  if (item.sourceLabel && item.sourceUrl) {
    return `${body} <a href="${item.sourceUrl}" style="color:#1d4ed8">${escapeHtml(item.sourceLabel)}</a>.`;
  }
  return body;
}

export function renderWeekly(content: WeeklyContent): RenderedWeekly {
  return {
    bodyText: renderText(content),
    bodyHtml: renderHtml(content),
  };
}

function renderText(c: WeeklyContent): string {
  const lines: string[] = [];
  lines.push("This week");
  lines.push(c.thisWeek);
  lines.push("");
  lines.push("Watch-fors this week");
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

function renderHtml(c: WeeklyContent): string {
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
    `<p style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 4px">Weekly Baby</p>` +
    `<h1 style="font-size:20px;color:#111827;margin:0 0 18px">Week ${c.week} &middot; ${escapeHtml(c.hook)}</h1>` +
    `<h2 ${H2}>This week</h2>` +
    `<p style="margin:0">${escapeHtml(c.thisWeek)}</p>` +
    `<h2 ${H2}>Watch-fors this week</h2>` +
    `<ul ${UL}>${watchFors}</ul>` +
    `<h2 ${H2}>Enrichment opportunities</h2>` +
    `<ul ${UL}>${enrichment}</ul>` +
    `<h2 ${H2}>Upcoming</h2>` +
    `<ul ${UL}>${upcoming}</ul>` +
    `</div></body></html>`
  );
}
