import { db } from "@/db";
import {
  babyProfile,
  parentContext,
  calendarEvents,
  type BabyProfile,
} from "@/db/schema";
import { gte, desc, or, eq } from "drizzle-orm";
import type { AgeContext } from "./age";
import { buildSubject } from "./subject";
import { eventsInWindow } from "./recurrence";

// Template-driven fallback render. Used when:
//   1. The Claude routine misses the daily slot.
//   2. The Anthropic API is unavailable.
// The template never invents milestones — it pulls from KB bucket files
// (loaded at deploy time as static imports) and the DB.

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
  citations: string[];
};

const PRE_BIRTH_FOCUS = `The hospital bag, car seat install, and pediatrician interview should be \
done by 38 weeks. If birth happens before then, these become same-day urgencies \
on top of recovery.`;

const FALLBACK_BUCKET_FOCUS: Record<string, string> = {
  "pre-birth": PRE_BIRTH_FOCUS,
  newborn: `Newborn priorities are minimal: feed on demand, safe sleep on the back \
in a flat empty crib, track wet/dirty diapers, and watch the umbilical stump. \
Developmental "milestones" at this stage are reflex-driven (rooting, Moro, grasp).`,
  infant: `Infants ride a fast curve. Each two-week window unlocks new motor or \
social abilities. The work this period is exposure: language input, varied \
textures and sounds, novel faces, predictable routines.`,
  older: `Beyond year one, the cadence of this newsletter slows. Toggle long-term \
mode in /baby settings.`,
};

export async function renderFallback(
  age: AgeContext,
  profile: BabyProfile,
  now = new Date()
): Promise<RenderedEmail> {
  const todayLabel =
    age.ageInDays < 0
      ? `${age.preBirthDaysRemaining} days until due date`
      : `Day ${age.ageInDays} (week ${age.weekIndex})`;

  const upcoming = (await loadUpcomingEvents(now, 14)).map((e) => ({
    eventDate: e.effectiveDate,
    title: e.title,
  }));
  const recentContext = await loadRecentContext(7);

  const focus =
    FALLBACK_BUCKET_FOCUS[age.status] ?? FALLBACK_BUCKET_FOCUS.infant;

  const babyName = profile.babyName ?? "the baby";

  // The fallback render has no real action item to surface, so it uses the
  // focus paragraph as the subject hook.
  const subject = buildSubject({ ageInDays: age.ageInDays, hook: focus });

  const lines: string[] = [];
  lines.push(`Today: ${todayLabel}`);
  lines.push("");
  lines.push("Focus");
  lines.push(focus);
  lines.push("");
  if (upcoming.length > 0) {
    lines.push("Upcoming (next 14 days)");
    for (const ev of upcoming) {
      lines.push(`- ${ev.eventDate}: ${ev.title}`);
    }
    lines.push("");
  }
  if (recentContext.length > 0) {
    lines.push("Recent context noted");
    for (const ctx of recentContext) {
      lines.push(`- ${ctx.contentType}: ${ctx.content}`);
    }
    lines.push("");
  }
  lines.push("---");
  lines.push(
    "This is a fallback render — the AI agent did not draft today. KB-driven content resumes tomorrow."
  );

  const text = lines.join("\n");
  const html = renderHtml({
    todayLabel,
    babyName,
    focus,
    upcoming,
    recentContext,
  });

  return {
    subject,
    html,
    text,
    citations: ["fallback-template"],
  };
}

async function loadUpcomingEvents(now: Date, days: number) {
  // Pull yearly events plus any one-time event dated on/after a year ago
  // (covers the window without dragging in ancient one-offs). Recurrence
  // expansion happens in eventsInWindow.
  const cutoff = new Date(now);
  cutoff.setFullYear(cutoff.getFullYear() - 1);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const all = await db
    .select()
    .from(calendarEvents)
    .where(
      or(
        eq(calendarEvents.recurrence, "yearly"),
        gte(calendarEvents.eventDate, cutoffStr)
      )
    );
  return eventsInWindow(all, now, days);
}

async function loadRecentContext(days: number) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  return db
    .select()
    .from(parentContext)
    .where(gte(parentContext.createdAt, since))
    .orderBy(desc(parentContext.createdAt))
    .limit(8);
}

function renderHtml({
  todayLabel,
  babyName,
  focus,
  upcoming,
  recentContext,
}: {
  todayLabel: string;
  babyName: string;
  focus: string;
  upcoming: { eventDate: string; title: string }[];
  recentContext: { contentType: string; content: string }[];
}): string {
  const upcomingHtml =
    upcoming.length === 0
      ? ""
      : `<h3 style="font-size:14px;margin:24px 0 8px;color:#111">Upcoming (next 14 days)</h3>
         <ul style="margin:0;padding-left:18px;color:#374151;font-size:14px;line-height:1.6">
           ${upcoming
             .map(
               (e) =>
                 `<li><strong>${e.eventDate}</strong> — ${escapeHtml(e.title)}</li>`
             )
             .join("")}
         </ul>`;

  const ctxHtml =
    recentContext.length === 0
      ? ""
      : `<h3 style="font-size:14px;margin:24px 0 8px;color:#111">Recent context noted</h3>
         <ul style="margin:0;padding-left:18px;color:#374151;font-size:14px;line-height:1.6">
           ${recentContext
             .map(
               (c) =>
                 `<li><em>${escapeHtml(c.contentType)}</em>: ${escapeHtml(c.content)}</li>`
             )
             .join("")}
         </ul>`;

  return `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:white;border-radius:8px;padding:24px;border:1px solid #e5e7eb">
    <p style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin:0">Daily Bay Baby</p>
    <h1 style="font-size:18px;color:#111;margin:4px 0 16px">${escapeHtml(todayLabel)}</h1>
    <p style="font-size:14px;color:#374151;line-height:1.6;margin:0">${escapeHtml(focus)}</p>
    ${upcomingHtml}
    ${ctxHtml}
    <p style="font-size:11px;color:#9ca3af;margin-top:32px;border-top:1px solid #e5e7eb;padding-top:12px">
      Fallback render. Reply to update ${escapeHtml(babyName)}'s context, or <a href="https://noahhshaw.com/baby" style="color:#6b7280">open the dashboard</a>.
    </p>
  </div>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function loadProfile(): Promise<BabyProfile | null> {
  const rows = await db.select().from(babyProfile).limit(1);
  return rows[0] ?? null;
}
