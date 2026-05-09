import { describe, it, expect } from "vitest";
import { computeAgeContext } from "../age-math";

const DUE = "2026-05-11";

describe("computeAgeContext", () => {
  it("pre-birth: ageInDays is negative, status is pre-birth, weekIndex is 0", () => {
    const ctx = computeAgeContext({
      now: new Date("2026-05-08T15:00:00Z"),
      dueDate: DUE,
    });
    expect(ctx.ageInDays).toBe(-3);
    expect(ctx.status).toBe("pre-birth");
    expect(ctx.weekIndex).toBe(0);
    expect(ctx.preBirthDaysRemaining).toBe(3);
  });

  it("on the due date itself: ageInDays is 0, status is newborn, weekIndex is 1", () => {
    const ctx = computeAgeContext({
      now: new Date("2026-05-11T12:00:00Z"),
      dueDate: DUE,
    });
    expect(ctx.ageInDays).toBe(0);
    expect(ctx.status).toBe("newborn");
    expect(ctx.weekIndex).toBe(1);
    expect(ctx.preBirthDaysRemaining).toBe(0);
  });

  it("birthDate overrides dueDate when set, even if birthDate is before due", () => {
    const ctx = computeAgeContext({
      now: new Date("2026-05-15T00:00:00Z"),
      dueDate: DUE,
      birthDate: "2026-05-09",
    });
    expect(ctx.ageInDays).toBe(6);
    expect(ctx.status).toBe("newborn");
    expect(ctx.weekIndex).toBe(1);
  });

  it("week 2 begins at day 7", () => {
    const ctx = computeAgeContext({
      now: new Date("2026-05-18T00:00:00Z"),
      dueDate: DUE,
    });
    expect(ctx.ageInDays).toBe(7);
    expect(ctx.weekIndex).toBe(2);
  });

  it("status transitions: newborn (≤28d) → infant (29–365d) → older", () => {
    const cases: Array<[number, string]> = [
      [0, "newborn"],
      [28, "newborn"],
      [29, "infant"],
      [365, "infant"],
      [366, "older"],
    ];
    for (const [day, expected] of cases) {
      const ctx = computeAgeContext({
        now: new Date(`2026-05-11T00:00:00Z`),
        dueDate: DUE,
        birthDate: addDays("2026-05-11", -day),
      });
      expect(ctx.ageInDays, `day ${day}`).toBe(day);
      expect(ctx.status, `day ${day}`).toBe(expected);
    }
  });

  it("preBirthDaysRemaining is 0 once born, even if the agent fires before due date", () => {
    const ctx = computeAgeContext({
      now: new Date("2026-05-09T00:00:00Z"),
      dueDate: DUE,
      birthDate: "2026-05-08",
    });
    expect(ctx.preBirthDaysRemaining).toBe(0);
    expect(ctx.ageInDays).toBe(1);
  });

  it("week 52 ends at day 363; day 364 begins week 53 (still infant until day 366)", () => {
    const week52Last = computeAgeContext({
      now: new Date("2027-05-09T00:00:00Z"),
      dueDate: DUE,
      birthDate: DUE,
    });
    expect(week52Last.ageInDays).toBe(363);
    expect(week52Last.weekIndex).toBe(52);
    expect(week52Last.status).toBe("infant");

    const week53First = computeAgeContext({
      now: new Date("2027-05-10T00:00:00Z"),
      dueDate: DUE,
      birthDate: DUE,
    });
    expect(week53First.ageInDays).toBe(364);
    expect(week53First.weekIndex).toBe(53);
    expect(week53First.status).toBe("infant");
  });
});

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
