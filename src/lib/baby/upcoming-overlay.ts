// Substitutes the {{UPCOMING_HTML}} / {{UPCOMING_TEXT}} placeholders in a
// pre-computed email body with the current calendar's next-14-day events.
// Called at send time so calendar edits take effect without regenerating.

export type UpcomingEvent = {
  effectiveDate: string;
  title: string;
};

export function buildUpcomingHtml(events: UpcomingEvent[]): string {
  if (events.length === 0) return "";
  const items = events
    .map(
      (e) =>
        `<li><strong>${escapeHtml(e.effectiveDate)}</strong> — ${escapeHtml(e.title)}</li>`
    )
    .join("");
  return `<h3 style="font-size:14px;margin:24px 0 8px;color:#111">Upcoming (next 14 days)</h3>
<ul style="margin:0;padding-left:18px;color:#374151;font-size:14px;line-height:1.6">${items}</ul>`;
}

export function buildUpcomingText(events: UpcomingEvent[]): string {
  if (events.length === 0) return "";
  const lines = ["Upcoming (next 14 days)"];
  for (const e of events) lines.push(`- ${e.effectiveDate}: ${e.title}`);
  return lines.join("\n");
}

export function applyOverlay(
  body: { html: string; text: string },
  events: UpcomingEvent[]
): { html: string; text: string } {
  return {
    html: body.html.replace("{{UPCOMING_HTML}}", buildUpcomingHtml(events)),
    text: body.text.replace("{{UPCOMING_TEXT}}", buildUpcomingText(events)),
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
