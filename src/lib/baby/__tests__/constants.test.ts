import { describe, it, expect } from "vitest";
import {
  isWhitelistedParent,
  parentByEmail,
  BABY_PARENTS,
} from "../constants";

describe("isWhitelistedParent", () => {
  it("accepts each parent's primary email", () => {
    expect(isWhitelistedParent(BABY_PARENTS.noah.email)).toBe(true);
    expect(isWhitelistedParent(BABY_PARENTS.anoushka.email)).toBe(true);
  });

  it("normalizes capitalization and surrounding whitespace", () => {
    expect(isWhitelistedParent("  NoahhShaw@gmail.com  ")).toBe(true);
    expect(isWhitelistedParent("VASWANI.ANOUSHKA@GMAIL.COM")).toBe(true);
  });

  it("rejects emails not on the allow list", () => {
    expect(isWhitelistedParent("attacker@evil.com")).toBe(false);
    expect(isWhitelistedParent("noah@gmail.com")).toBe(false); // missing 'h'
    expect(isWhitelistedParent("")).toBe(false);
  });
});

describe("parentByEmail", () => {
  it("returns the parent record for a known email (case-insensitive)", () => {
    const noah = parentByEmail("NoahhShaw@gmail.com");
    expect(noah?.firstName).toBe("Noah");
    expect(noah?.role).toBe("primary");

    const anoushka = parentByEmail("vaswani.anoushka@gmail.com");
    expect(anoushka?.firstName).toBe("Anoushka");
    expect(anoushka?.role).toBe("partner");
  });

  it("returns undefined for unknown emails", () => {
    expect(parentByEmail("attacker@evil.com")).toBeUndefined();
  });
});
