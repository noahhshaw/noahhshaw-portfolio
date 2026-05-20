import { describe, it, expect } from "vitest";
import { stripQuotedHistory } from "../classifier";

describe("stripQuotedHistory", () => {
  it("returns input unchanged when no quote marker is present", () => {
    const t = "Hello,\n\nFollow-up question about feeding.\n\nThanks";
    expect(stripQuotedHistory(t)).toBe(t);
  });

  it("cuts at a Gmail attribution line", () => {
    const t = [
      "New question I have.",
      "",
      "On Wed, May 20, 2026 at 9:41 AM, Daily Baby <daily-baby@noahhshaw.com> wrote:",
      "> Day 11. Feeding is settling.",
      "> Action items",
      "> - …",
    ].join("\n");
    expect(stripQuotedHistory(t)).toBe("New question I have.");
  });

  it("cuts at the first run of '> '-prefixed lines when no attribution is present", () => {
    const t = [
      "Quick follow-up.",
      "",
      "> Day 10 content goes here.",
      "> More quoted content.",
    ].join("\n");
    expect(stripQuotedHistory(t)).toBe("Quick follow-up.");
  });

  it("does NOT cut on a single '> ' line that might be a quotation in prose", () => {
    const t = "I once said > this is fine in prose and we kept going.";
    expect(stripQuotedHistory(t)).toBe(t);
  });

  it("cuts at the [Quoted text hidden] marker", () => {
    const t = [
      "Following up on yesterday.",
      "",
      "[Quoted text hidden]",
    ].join("\n");
    expect(stripQuotedHistory(t)).toBe("Following up on yesterday.");
  });

  it("handles empty / null-ish inputs", () => {
    expect(stripQuotedHistory("")).toBe("");
    expect(stripQuotedHistory("   ")).toBe("");
  });

  it("preserves multi-paragraph user content before the quote", () => {
    const t = [
      "Paragraph one of new content.",
      "",
      "Paragraph two with a question.",
      "",
      "On Wed, May 20, 2026 at 9:41 AM, Daily Baby <x@y.com> wrote:",
      "> quoted",
    ].join("\n");
    const got = stripQuotedHistory(t);
    expect(got).toContain("Paragraph one");
    expect(got).toContain("Paragraph two");
    expect(got).not.toContain("quoted");
    expect(got).not.toContain("wrote:");
  });

  it("dramatically reduces length on a realistic Gmail reply", () => {
    const longQuote = Array(200).fill("> Day 11 content line.").join("\n");
    const t = `Short reply.\n\nOn Wed, May 20, 2026 at 9:41 AM, Daily Baby <x@y.com> wrote:\n${longQuote}`;
    const got = stripQuotedHistory(t);
    expect(got.length).toBeLessThan(50);
    expect(t.length).toBeGreaterThan(2000);
  });
});
