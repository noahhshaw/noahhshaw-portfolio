import { describe, it, expect } from "vitest";
import {
  cleanReplyText,
  cleanReplyHtml,
  validateReplyText,
  validateReplyHtml,
} from "../output-cleaner";

describe("cleanReplyText", () => {
  it("removes markdown bold", () => {
    expect(cleanReplyText("This is **important** advice.")).toBe(
      "This is important advice."
    );
  });

  it("removes horizontal rules", () => {
    expect(
      cleanReplyText("Para one.\n\n---\n\nPara two.")
    ).toBe("Para one.\n\nPara two.");
  });

  it("strips dash list markers", () => {
    const got = cleanReplyText("- first item\n- second item\n- third");
    expect(got).toBe("first item\nsecond item\nthird");
  });

  it("strips numbered list markers", () => {
    const got = cleanReplyText("1. Pace bottle feeding.\n2. Offer breast first.");
    expect(got).toBe("Pace bottle feeding.\nOffer breast first.");
  });

  it("removes code fences but preserves content", () => {
    const got = cleanReplyText("```\nfoo bar\n```");
    expect(got).toBe("foo bar");
  });

  it("strips inline backticks", () => {
    expect(cleanReplyText("Use `npm test` to verify.")).toBe(
      "Use npm test to verify."
    );
  });

  it("is idempotent on clean prose", () => {
    const clean = "This is a normal paragraph.\n\nAnother paragraph here.";
    expect(cleanReplyText(clean)).toBe(clean);
  });

  it("collapses runs of blank lines to two", () => {
    expect(cleanReplyText("a\n\n\n\nb")).toBe("a\n\nb");
  });

  it("does not corrupt URLs containing dashes/asterisks/underscores", () => {
    const got = cleanReplyText(
      "See https://example.com/Umbilical-Cord-Care and https://example.com/foo_bar"
    );
    expect(got).toContain("https://example.com/Umbilical-Cord-Care");
    expect(got).toContain("https://example.com/foo_bar");
  });
});

describe("validateReplyText", () => {
  it("flags markdown bold", () => {
    const r = validateReplyText("Some **bold** here.");
    expect(r.ok).toBe(false);
    expect(r.violations).toContain("markdown-bold");
  });

  it("flags --- horizontal rule", () => {
    const r = validateReplyText("para\n\n---\n\npara");
    expect(r.ok).toBe(false);
    expect(r.violations).toContain("horizontal-rule");
  });

  it("flags leading list markers", () => {
    expect(validateReplyText("- a\n- b").violations).toContain(
      "leading-dash-list"
    );
    expect(validateReplyText("1. a\n2. b").violations).toContain(
      "leading-num-list"
    );
  });

  it("clean prose is valid", () => {
    expect(
      validateReplyText("Paragraph one.\n\nParagraph two. See https://example.com.").ok
    ).toBe(true);
  });
});

describe("cleanReplyHtml", () => {
  it("paragraph-wraps plain text input on blank-line boundaries", () => {
    const html = cleanReplyHtml("Para one.\n\nPara two.");
    expect(html).toContain("<p");
    expect(html.match(/<p[\s>]/g)?.length).toBe(2);
  });

  it("auto-links bare URLs in plain-text input with hostname anchor", () => {
    const html = cleanReplyHtml(
      "See AAP guidance at https://www.healthychildren.org/foo for more."
    );
    expect(html).toContain(
      '<a href="https://www.healthychildren.org/foo"'
    );
    expect(html).toContain(">healthychildren.org<");
    expect(html).not.toContain(">https://www.healthychildren.org/foo<");
  });

  it("passes through existing HTML and converts leaked markdown bold to <strong>", () => {
    const html = cleanReplyHtml(
      "<p>Some **bold** text and a <a href='https://x.com'>x</a>.</p>"
    );
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("href='https://x.com'");
  });
});

describe("validateReplyHtml", () => {
  it("flags anchor where visible text equals the href", () => {
    const r = validateReplyHtml(
      '<p>See <a href="https://x.com/foo">https://x.com/foo</a>.</p>'
    );
    expect(r.ok).toBe(false);
    expect(r.violations).toContain("anchor-text-equals-href");
  });

  it("flags bare URLs outside of anchors", () => {
    const r = validateReplyHtml(
      "<p>See https://example.com/foo for details.</p>"
    );
    expect(r.ok).toBe(false);
    expect(r.violations).toContain("bare-url-in-body");
  });

  it("flags raw markdown bold in HTML", () => {
    const r = validateReplyHtml("<p>Some **bold** here.</p>");
    expect(r.ok).toBe(false);
    expect(r.violations).toContain("markdown-bold-in-html");
  });

  it("anchored URL with humanized text passes", () => {
    const r = validateReplyHtml(
      '<p>See <a href="https://www.example.com/foo">example.com</a> for details.</p>'
    );
    expect(r.ok).toBe(true);
  });
});
