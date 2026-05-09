// Yearly-recurrence date math.
//
// Calendar events with recurrence='yearly' (e.g. Mother's Day,
// grandparent birthdays) need to surface in the renderer's "upcoming
// 14 days" window every year, not just the year they were added.
//
// nextOccurrence(eventDate, fromDate) returns the next instance of
// (month, day-of-month) on-or-after fromDate. Handles leap-year birthdays
// (Feb 29) by rolling them to Feb 28 in non-leap years.

export function nextOccurrence(eventDate: string, fromDate: Date): Date {
  const [, monthStr, dayStr] = eventDate.split("-");
  const month = Number(monthStr) - 1; // 0-indexed for Date
  const day = Number(dayStr);
  if (
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    month < 0 ||
    month > 11 ||
    day < 1 ||
    day > 31
  ) {
    throw new Error(`invalid eventDate: ${eventDate}`);
  }

  const fromYear = fromDate.getUTCFullYear();
  for (const year of [fromYear, fromYear + 1]) {
    const candidate = new Date(Date.UTC(year, month, day));
    // Date overflow handling: if month=1, day=29 in a non-leap year,
    // JS rolls forward to March 1; we want to roll back to Feb 28.
    if (
      candidate.getUTCMonth() !== month ||
      candidate.getUTCDate() !== day
    ) {
      const fallback = new Date(Date.UTC(year, month + 1, 0)); // last day of target month
      if (
        fallback.getTime() >=
        Date.UTC(
          fromDate.getUTCFullYear(),
          fromDate.getUTCMonth(),
          fromDate.getUTCDate()
        )
      ) {
        return fallback;
      }
      continue;
    }
    if (
      candidate.getTime() >=
      Date.UTC(
        fromDate.getUTCFullYear(),
        fromDate.getUTCMonth(),
        fromDate.getUTCDate()
      )
    ) {
      return candidate;
    }
  }
  // Should be unreachable.
  throw new Error("nextOccurrence failed to compute");
}

export type EventLike = {
  eventDate: string;
  recurrence: string;
  title?: string;
};

// Filter and project events that fall within [from, from+windowDays].
// One-time events are kept as-is; yearly events are projected to their
// next occurrence within the window (or dropped if the next occurrence
// is past the window).
export function eventsInWindow<T extends EventLike>(
  events: T[],
  from: Date,
  windowDays: number
): Array<T & { effectiveDate: string }> {
  const windowEnd = new Date(from);
  windowEnd.setUTCDate(windowEnd.getUTCDate() + windowDays);
  const out: Array<T & { effectiveDate: string }> = [];

  for (const e of events) {
    if (e.recurrence === "yearly") {
      const next = nextOccurrence(e.eventDate, from);
      if (next.getTime() <= windowEnd.getTime()) {
        out.push({ ...e, effectiveDate: next.toISOString().slice(0, 10) });
      }
    } else {
      const d = new Date(e.eventDate + "T00:00:00Z");
      if (
        d.getTime() >= startOfUtcDay(from).getTime() &&
        d.getTime() <= windowEnd.getTime()
      ) {
        out.push({ ...e, effectiveDate: e.eventDate });
      }
    }
  }
  out.sort((a, b) => (a.effectiveDate < b.effectiveDate ? -1 : 1));
  return out;
}

function startOfUtcDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
}
