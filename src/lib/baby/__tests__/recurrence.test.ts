import { describe, it, expect } from "vitest";
import { nextOccurrence, eventsInWindow } from "../recurrence";

describe("nextOccurrence", () => {
  it("future date in the same year returns this year's date", () => {
    const d = nextOccurrence("2024-03-12", new Date("2026-01-15T00:00:00Z"));
    expect(d.toISOString().slice(0, 10)).toBe("2026-03-12");
  });

  it("past date in the same year returns next year's date", () => {
    const d = nextOccurrence("2024-03-12", new Date("2026-04-01T00:00:00Z"));
    expect(d.toISOString().slice(0, 10)).toBe("2027-03-12");
  });

  it("today's date counts as current year (not bumped)", () => {
    const d = nextOccurrence("2024-05-08", new Date("2026-05-08T00:00:00Z"));
    expect(d.toISOString().slice(0, 10)).toBe("2026-05-08");
  });

  it("Feb 29 birthday rolls to Feb 28 in non-leap years", () => {
    // 2027 is not a leap year. Feb 29 should fall back to Feb 28.
    const d = nextOccurrence("2024-02-29", new Date("2027-01-01T00:00:00Z"));
    expect(d.toISOString().slice(0, 10)).toBe("2027-02-28");
  });

  it("Feb 29 birthday in a leap year stays on Feb 29", () => {
    // 2028 IS a leap year.
    const d = nextOccurrence("2024-02-29", new Date("2028-01-01T00:00:00Z"));
    expect(d.toISOString().slice(0, 10)).toBe("2028-02-29");
  });

  it("throws on malformed event date", () => {
    expect(() =>
      nextOccurrence("not-a-date", new Date("2026-01-01T00:00:00Z"))
    ).toThrow();
    expect(() =>
      nextOccurrence("2024-13-01", new Date("2026-01-01T00:00:00Z"))
    ).toThrow();
  });
});

describe("eventsInWindow", () => {
  const FROM = new Date("2026-05-08T00:00:00Z");

  it("includes one-time events that fall inside the window", () => {
    const out = eventsInWindow(
      [{ eventDate: "2026-05-15", recurrence: "none", title: "x" }],
      FROM,
      14
    );
    expect(out).toHaveLength(1);
    expect(out[0].effectiveDate).toBe("2026-05-15");
  });

  it("excludes one-time events outside the window", () => {
    const out = eventsInWindow(
      [
        { eventDate: "2026-05-07", recurrence: "none", title: "yesterday" },
        { eventDate: "2026-06-01", recurrence: "none", title: "later" },
      ],
      FROM,
      14
    );
    expect(out).toHaveLength(0);
  });

  it("expands yearly events to their next occurrence within the window", () => {
    const out = eventsInWindow(
      [
        // Mother's Day 2026 lands on May 10 in real life; for the test we
        // use a fixed event_date.
        { eventDate: "2024-05-10", recurrence: "yearly", title: "Mother's Day" },
      ],
      FROM,
      14
    );
    expect(out).toHaveLength(1);
    expect(out[0].effectiveDate).toBe("2026-05-10");
  });

  it("drops yearly events whose next occurrence is past the window", () => {
    const out = eventsInWindow(
      [
        { eventDate: "2024-08-15", recurrence: "yearly", title: "August date" },
      ],
      FROM,
      14
    );
    expect(out).toHaveLength(0);
  });

  it("sorts by effective date across one-time and yearly", () => {
    const out = eventsInWindow(
      [
        { eventDate: "2026-05-20", recurrence: "none", title: "later" },
        { eventDate: "2024-05-10", recurrence: "yearly", title: "earlier" },
        { eventDate: "2026-05-15", recurrence: "none", title: "middle" },
      ],
      FROM,
      14
    );
    expect(out.map((e) => e.effectiveDate)).toEqual([
      "2026-05-10",
      "2026-05-15",
      "2026-05-20",
    ]);
  });

  it("yearly event today is included", () => {
    const out = eventsInWindow(
      [{ eventDate: "2024-05-08", recurrence: "yearly", title: "today" }],
      FROM,
      14
    );
    expect(out).toHaveLength(1);
    expect(out[0].effectiveDate).toBe("2026-05-08");
  });
});
