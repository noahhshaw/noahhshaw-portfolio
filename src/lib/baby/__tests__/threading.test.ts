import { describe, it, expect } from "vitest";
import {
  buildThreadHeaders,
  angleBracket,
  normalizeSubject,
} from "../threading";

describe("angleBracket", () => {
  it("wraps a bare id", () => {
    expect(angleBracket("abc@gmail.com")).toBe("<abc@gmail.com>");
  });
  it("preserves an already-bracketed id", () => {
    expect(angleBracket("<abc@gmail.com>")).toBe("<abc@gmail.com>");
  });
  it("strips quotes", () => {
    expect(angleBracket('"abc@gmail.com"')).toBe("<abc@gmail.com>");
  });
  it("returns null for null/empty", () => {
    expect(angleBracket(null)).toBeNull();
    expect(angleBracket("")).toBeNull();
    expect(angleBracket("  ")).toBeNull();
  });
});

describe("normalizeSubject", () => {
  it("adds Re: when missing", () => {
    expect(normalizeSubject("Day 4: jaundice")).toBe("Re: Day 4: jaundice");
  });
  it("preserves single Re:", () => {
    expect(normalizeSubject("Re: Day 4: jaundice")).toBe("Re: Day 4: jaundice");
  });
  it("collapses multiple Re:", () => {
    expect(normalizeSubject("Re: Re: Re: Day 4")).toBe("Re: Day 4");
  });
  it("handles different cases", () => {
    expect(normalizeSubject("RE: Day 4")).toBe("Re: Day 4");
    expect(normalizeSubject("re : Day 4")).toBe("Re: Day 4");
  });
});

describe("buildThreadHeaders", () => {
  it("uses the inbound subject verbatim when it already starts with Re:", () => {
    const h = buildThreadHeaders({
      inboundSubject: "Re: Day 4: jaundice peak day",
      inboundMessageId: "<reply-abc@gmail.com>",
      originalDailyMessageId: "<daily-xyz@noahhshaw.com>",
    });
    expect(h.Subject).toBe("Re: Day 4: jaundice peak day");
  });

  it("prepends Re: when the inbound lacks it", () => {
    const h = buildThreadHeaders({
      inboundSubject: "Day 4: jaundice peak day",
      inboundMessageId: "<reply-abc@gmail.com>",
    });
    expect(h.Subject).toBe("Re: Day 4: jaundice peak day");
  });

  it("falls back to original daily subject when inbound subject is null", () => {
    const h = buildThreadHeaders({
      inboundSubject: null,
      inboundMessageId: "<r@x>",
      originalDailySubject: "Day 5: cord stump",
    });
    expect(h.Subject).toBe("Re: Day 5: cord stump");
  });

  it("builds References chain with daily + reply mids", () => {
    const h = buildThreadHeaders({
      inboundSubject: "Re: Day 4",
      inboundMessageId: "reply-abc@gmail.com",
      originalDailyMessageId: "daily-xyz@noahhshaw.com",
    });
    expect(h.References).toBe(
      "<daily-xyz@noahhshaw.com> <reply-abc@gmail.com>"
    );
    expect(h["In-Reply-To"]).toBe("<reply-abc@gmail.com>");
  });

  it("References has just the reply id when no daily mid is known", () => {
    const h = buildThreadHeaders({
      inboundSubject: "Re: Day 4",
      inboundMessageId: "<reply-abc@gmail.com>",
    });
    expect(h.References).toBe("<reply-abc@gmail.com>");
  });

  it("never duplicates a single id in the chain", () => {
    const h = buildThreadHeaders({
      inboundSubject: "Re: Day 4",
      inboundMessageId: "abc@x",
      originalDailyMessageId: "abc@x",
    });
    expect(h.References).toBe("<abc@x>");
  });

  it("emits empty In-Reply-To when no inbound mid is available", () => {
    const h = buildThreadHeaders({
      inboundSubject: "Re: Day 4",
      inboundMessageId: null,
    });
    expect(h["In-Reply-To"]).toBe("");
  });

  it("safe fallback subject when everything is missing", () => {
    const h = buildThreadHeaders({
      inboundSubject: null,
      inboundMessageId: null,
    });
    expect(h.Subject).toBe("Re: (no subject)");
  });
});
