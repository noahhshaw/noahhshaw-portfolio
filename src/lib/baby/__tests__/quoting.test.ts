import { describe, it, expect } from "vitest";
import {
  buildAttributionLine,
  buildHtmlWithQuote,
  buildPlainTextWithQuote,
  extractFromName,
  formatAttributionDate,
  quoteBodyText,
} from "../quoting";

// Pacific-DST anchor: 2026-05-14 19:50 PT == 2026-05-15T02:50:00Z
const SAMPLE_DATE = new Date("2026-05-15T02:50:00Z");

describe("formatAttributionDate", () => {
  it("renders Pacific date in Gmail style", () => {
    const s = formatAttributionDate(SAMPLE_DATE);
    expect(s).toMatch(/^Thu, May 14, 2026 at \d{1,2}:50\s?PM$/);
  });
});

describe("buildAttributionLine", () => {
  it("uses name when provided", () => {
    const line = buildAttributionLine({
      fromEmail: "noahhshaw@gmail.com",
      fromName: "Noah Shaw",
      receivedAt: SAMPLE_DATE,
      bodyText: null,
      bodyHtml: null,
    });
    expect(line).toMatch(/^On Thu, May 14, 2026 at \d{1,2}:50 ?PM, Noah Shaw <noahhshaw@gmail.com> wrote:$/);
  });

  it("falls back to email only when no name", () => {
    const line = buildAttributionLine({
      fromEmail: "noahhshaw@gmail.com",
      receivedAt: SAMPLE_DATE,
      bodyText: null,
      bodyHtml: null,
    });
    expect(line).toMatch(/^On .* at .*, <noahhshaw@gmail.com> wrote:$/);
  });
});

describe("quoteBodyText", () => {
  it("prefixes every line with > ", () => {
    expect(quoteBodyText("first\nsecond")).toBe("> first\n> second");
  });

  it("uses bare > for blank lines", () => {
    expect(quoteBodyText("a\n\nb")).toBe("> a\n>\n> b");
  });

  it("nests already-quoted lines", () => {
    expect(quoteBodyText("> prior quote\nnew text")).toBe(
      "> > prior quote\n> new text"
    );
  });
});

describe("buildPlainTextWithQuote", () => {
  it("appends attribution + quoted body after the agent prose with a blank line gap", () => {
    const out = buildPlainTextWithQuote("Four.", {
      fromEmail: "noahhshaw@gmail.com",
      fromName: "Noah Shaw",
      receivedAt: SAMPLE_DATE,
      bodyText: "what is 2+2?",
      bodyHtml: null,
    });
    expect(out).toMatch(/^Four\.\n\nOn .* wrote:\n> what is 2\+2\?\n$/);
  });

  it("falls back to a placeholder when inbound text is null", () => {
    const out = buildPlainTextWithQuote("hi", {
      fromEmail: "noahhshaw@gmail.com",
      receivedAt: SAMPLE_DATE,
      bodyText: null,
      bodyHtml: null,
    });
    expect(out).toContain("> (no plain-text body)");
  });
});

describe("buildHtmlWithQuote", () => {
  it("wraps the inbound HTML in a gmail_quote blockquote after the agent HTML", () => {
    const out = buildHtmlWithQuote("<p>Four.</p>", {
      fromEmail: "noahhshaw@gmail.com",
      fromName: "Noah Shaw",
      receivedAt: SAMPLE_DATE,
      bodyText: null,
      bodyHtml: "<div>what is 2+2?</div>",
    });
    expect(out).toContain('<div class="gmail_quote gmail_quote_container">');
    expect(out).toContain('<blockquote class="gmail_quote"');
    expect(out).toContain("<div>what is 2+2?</div>");
    expect(out.indexOf("Four.")).toBeLessThan(out.indexOf("gmail_quote"));
  });

  it("escapes the attribution line", () => {
    const out = buildHtmlWithQuote("<p>ok</p>", {
      fromEmail: "noah@example.com",
      fromName: "Noah & Co",
      receivedAt: SAMPLE_DATE,
      bodyText: null,
      bodyHtml: "<i>hello</i>",
    });
    expect(out).toContain("Noah &amp; Co");
  });

  it("paragraph-wraps inbound text when no inbound HTML is available", () => {
    const out = buildHtmlWithQuote("<p>ok</p>", {
      fromEmail: "noah@example.com",
      receivedAt: SAMPLE_DATE,
      bodyText: "first line\n\nsecond para",
      bodyHtml: null,
    });
    expect(out).toContain("<p>first line</p>");
    expect(out).toContain("<p>second para</p>");
  });
});

describe("extractFromName", () => {
  it("parses 'Name <email>' from an object header bag", () => {
    expect(extractFromName({ from: "Noah Shaw <noahhshaw@gmail.com>" })).toBe(
      "Noah Shaw"
    );
  });

  it("handles capitalized header key", () => {
    expect(extractFromName({ From: "Noah Shaw <noahhshaw@gmail.com>" })).toBe(
      "Noah Shaw"
    );
  });

  it("strips wrapping quotes", () => {
    expect(extractFromName({ from: '"Noah Shaw" <n@x>' })).toBe("Noah Shaw");
  });

  it("returns null when header is just an email", () => {
    expect(extractFromName({ from: "noahhshaw@gmail.com" })).toBeNull();
  });

  it("returns null for missing/invalid input", () => {
    expect(extractFromName(null)).toBeNull();
    expect(extractFromName(undefined)).toBeNull();
    expect(extractFromName({})).toBeNull();
    expect(extractFromName({ from: "" })).toBeNull();
  });

  it("supports array-of-pairs shape", () => {
    expect(
      extractFromName([{ name: "From", value: "Noah Shaw <n@x>" }])
    ).toBe("Noah Shaw");
  });
});
