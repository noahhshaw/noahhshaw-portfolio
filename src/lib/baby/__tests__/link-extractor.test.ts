import { describe, it, expect } from "vitest";
import { extractUrls } from "../validators";

describe("extractUrls", () => {
  it("pulls bare URLs from prose", () => {
    const text =
      "See https://www.cdc.gov/milestones for context and http://example.org/foo for more.";
    expect(extractUrls(text).sort()).toEqual([
      "http://example.org/foo",
      "https://www.cdc.gov/milestones",
    ]);
  });

  it("strips trailing punctuation", () => {
    expect(extractUrls("Read https://example.com/page.")).toEqual([
      "https://example.com/page",
    ]);
    expect(extractUrls("see https://example.com)")).toEqual([
      "https://example.com",
    ]);
  });

  it("dedupes", () => {
    expect(
      extractUrls("https://example.com\nhttps://example.com")
    ).toEqual(["https://example.com"]);
  });

  it("pulls URLs from HTML href attributes", () => {
    const html = '<a href="https://www.aap.org/page">link</a>';
    expect(extractUrls(html)).toContain("https://www.aap.org/page");
  });

  it("returns empty array on no URLs", () => {
    expect(extractUrls("no urls here")).toEqual([]);
  });
});
