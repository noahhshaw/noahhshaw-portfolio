import { describe, it, expect } from "vitest";
import { buildSubject, SUBJECT_MAX_LENGTH } from "../subject";

describe("buildSubject", () => {
  it("formats Day N: hook with the hook lowercased", () => {
    expect(
      buildSubject({
        ageInDays: 7,
        hook: "Schedule first-week visit; weight-regain window open",
      })
    ).toBe("Day 7: schedule first-week visit; weight-regain window open");
  });

  it("never exceeds 72 characters", () => {
    const subj = buildSubject({
      ageInDays: 100,
      hook:
        "This is a very long action item that will certainly need to be truncated by the subject builder to keep the line short enough to render in mail clients",
    });
    expect(subj.length).toBeLessThanOrEqual(SUBJECT_MAX_LENGTH);
  });

  it("truncates cleanly at word/punctuation boundaries", () => {
    const subj = buildSubject({
      ageInDays: 100,
      hook:
        "This is a very long action item that will certainly need to be truncated by the subject builder to keep the line short",
    });
    // Should not end mid-sentence with a dangling space, comma, or hyphen.
    expect(subj).not.toMatch(/[\s,;:.\-]$/);
  });

  it("strips emoji", () => {
    const subj = buildSubject({
      ageInDays: 7,
      hook: "🎉 great milestone today",
    });
    expect(subj).not.toContain("🎉");
    expect(subj).toContain("great milestone today");
  });

  it("strips exclamation points", () => {
    const subj = buildSubject({
      ageInDays: 14,
      hook: "Birth-weight regained!",
    });
    expect(subj).not.toContain("!");
  });

  it("handles negative ageInDays for pre-birth", () => {
    const subj = buildSubject({
      ageInDays: -3,
      hook: "Hospital bag check; pediatrician interview by tomorrow",
    });
    expect(subj.startsWith("Day -3:")).toBe(true);
  });

  it("returns just the day label if the hook is empty", () => {
    expect(buildSubject({ ageInDays: 5, hook: "" })).toBe("Day 5");
    expect(buildSubject({ ageInDays: 5, hook: "   " })).toBe("Day 5");
  });

  it("collapses runs of whitespace in the hook", () => {
    expect(
      buildSubject({ ageInDays: 7, hook: "schedule\n  first  week\tvisit" })
    ).toBe("Day 7: schedule first week visit");
  });
});
