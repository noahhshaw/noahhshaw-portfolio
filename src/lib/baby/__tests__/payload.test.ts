import { describe, it, expect } from "vitest";
import { extractEmail, extractEmailList } from "../payload";

describe("extractEmail", () => {
  it("returns the string when given a bare email string", () => {
    expect(extractEmail("noah@gmail.com")).toBe("noah@gmail.com");
  });

  it("extracts .email from an object form", () => {
    expect(extractEmail({ email: "noah@gmail.com", name: "Noah" })).toBe(
      "noah@gmail.com"
    );
  });

  it("returns undefined for null/undefined/empty", () => {
    expect(extractEmail(null)).toBeUndefined();
    expect(extractEmail(undefined)).toBeUndefined();
    expect(extractEmail("")).toBeUndefined();
    expect(extractEmail({})).toBeUndefined();
  });

  it("returns undefined when .email is not a string", () => {
    expect(extractEmail({ email: 42 })).toBeUndefined();
    expect(extractEmail({ email: null })).toBeUndefined();
  });

  it("returns undefined for non-string, non-object values", () => {
    expect(extractEmail(42)).toBeUndefined();
    expect(extractEmail(true)).toBeUndefined();
    expect(extractEmail([])).toBeUndefined();
  });
});

describe("extractEmailList", () => {
  it("normalizes mixed-form arrays to lowercase strings", () => {
    expect(
      extractEmailList(["Noah@Gmail.com", { email: "ANUSHKA@gmail.com" }])
    ).toEqual(["noah@gmail.com", "anushka@gmail.com"]);
  });

  it("filters out unparseable entries", () => {
    expect(
      extractEmailList([
        "noah@gmail.com",
        null,
        undefined,
        { email: 42 },
        { email: "anushka@gmail.com" },
      ])
    ).toEqual(["noah@gmail.com", "anushka@gmail.com"]);
  });

  it("returns empty array on non-array input", () => {
    expect(extractEmailList(undefined)).toEqual([]);
    expect(extractEmailList(null)).toEqual([]);
    expect(extractEmailList("noah@gmail.com")).toEqual([]);
    expect(extractEmailList({ email: "noah@gmail.com" })).toEqual([]);
  });
});
