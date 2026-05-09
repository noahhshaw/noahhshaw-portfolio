import { describe, it, expect } from "vitest";
import { makePhotoKey } from "../r2";

describe("makePhotoKey", () => {
  it("includes the photos/ prefix", () => {
    const key = makePhotoKey({
      uploadedByEmail: "noahhshaw@gmail.com",
      filename: "smile.jpg",
      takenAt: new Date("2026-05-12T12:00:00Z"),
    });
    expect(key.startsWith("photos/")).toBe(true);
  });

  it("uses takenAt for the timestamp prefix when provided", () => {
    const key = makePhotoKey({
      uploadedByEmail: "noahhshaw@gmail.com",
      filename: "smile.jpg",
      takenAt: new Date("2026-05-12T12:30:45Z"),
    });
    expect(key).toContain("2026-05-12T12-30-45");
  });

  it("sanitizes filenames into a-z0-9._-", () => {
    const key = makePhotoKey({
      uploadedByEmail: "noahhshaw@gmail.com",
      filename: "Eli's First Smile.HEIC",
      takenAt: new Date("2026-05-12T12:00:00Z"),
    });
    expect(key).toMatch(/eli-s-first-smile.heic$/);
    expect(key).not.toContain("'");
    expect(key).not.toContain(" ");
  });

  it("sanitizes the email prefix to a short, safe slug", () => {
    const key = makePhotoKey({
      uploadedByEmail: "Vaswani.Anoushka@gmail.com",
      filename: "test.jpg",
      takenAt: new Date("2026-05-12T12:00:00Z"),
    });
    // The slug is the lowercased local-part with non-alphanumerics replaced.
    expect(key).toMatch(/-vaswani-anoushka-/);
  });

  it("caps absurdly long filenames", () => {
    const long = "a".repeat(500) + ".jpg";
    const key = makePhotoKey({
      uploadedByEmail: "noahhshaw@gmail.com",
      filename: long,
      takenAt: new Date("2026-05-12T12:00:00Z"),
    });
    // Filename slice cap is 80 chars in the implementation; the full key
    // should be well under R2's 1024-byte key limit.
    expect(key.length).toBeLessThan(200);
  });

  it("falls back to current time when takenAt is omitted", () => {
    const key = makePhotoKey({
      uploadedByEmail: "noahhshaw@gmail.com",
      filename: "test.jpg",
    });
    // Should still contain a timestamp segment; not asserting exact value.
    expect(key).toMatch(/photos\/\d{4}-\d{2}-\d{2}T/);
  });

  it("two calls with different filenames at the same instant produce different keys", () => {
    const t = new Date("2026-05-12T12:00:00Z");
    const a = makePhotoKey({
      uploadedByEmail: "noahhshaw@gmail.com",
      filename: "alpha.jpg",
      takenAt: t,
    });
    const b = makePhotoKey({
      uploadedByEmail: "noahhshaw@gmail.com",
      filename: "beta.jpg",
      takenAt: t,
    });
    expect(a).not.toBe(b);
  });
});
