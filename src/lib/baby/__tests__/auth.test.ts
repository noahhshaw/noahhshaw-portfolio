import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { issueSessionCookie, readSessionCookie } from "../auth";

const ORIG_ENV: Partial<NodeJS.ProcessEnv> = {};

beforeAll(() => {
  ORIG_ENV.BABY_SESSION_SECRET = process.env.BABY_SESSION_SECRET;
  // 32 bytes of test entropy.
  process.env.BABY_SESSION_SECRET =
    "test-secret-do-not-use-in-prod-1234567890abcdef";
});

afterAll(() => {
  if (ORIG_ENV.BABY_SESSION_SECRET === undefined) {
    delete process.env.BABY_SESSION_SECRET;
  } else {
    process.env.BABY_SESSION_SECRET = ORIG_ENV.BABY_SESSION_SECRET;
  }
});

function splitCookie(cookie: string): {
  email: string;
  expiresAt: string;
  sig: string;
} {
  const lastDot = cookie.lastIndexOf(".");
  const sig = cookie.slice(lastDot + 1);
  const rest = cookie.slice(0, lastDot);
  const secondLastDot = rest.lastIndexOf(".");
  return {
    email: rest.slice(0, secondLastDot),
    expiresAt: rest.slice(secondLastDot + 1),
    sig,
  };
}

describe("session cookie HMAC", () => {
  it("issues a cookie that round-trips back to the same email", async () => {
    const cookie = await issueSessionCookie("noahhshaw@gmail.com");
    const result = await readSessionCookie(cookie);
    expect(result).toEqual({ email: "noahhshaw@gmail.com" });
  });

  it("rejects a cookie whose signature has been tampered with", async () => {
    const cookie = await issueSessionCookie("noahhshaw@gmail.com");
    const { email, expiresAt, sig } = splitCookie(cookie);
    const flipped = sig.slice(0, -1) + (sig.endsWith("A") ? "B" : "A");
    const tampered = `${email}.${expiresAt}.${flipped}`;
    expect(await readSessionCookie(tampered)).toBeNull();
  });

  it("rejects a cookie whose email payload has been swapped", async () => {
    const cookie = await issueSessionCookie("noahhshaw@gmail.com");
    const { expiresAt, sig } = splitCookie(cookie);
    const tampered = `attacker@evil.com.${expiresAt}.${sig}`;
    expect(await readSessionCookie(tampered)).toBeNull();
  });

  it("rejects a cookie whose expiry has been bumped to the future", async () => {
    const cookie = await issueSessionCookie("noahhshaw@gmail.com");
    const { email, expiresAt: _, sig } = splitCookie(cookie);
    const tampered = `${email}.${
      Math.floor(Date.now() / 1000) + 1000 * 365 * 24 * 60 * 60
    }.${sig}`;
    expect(await readSessionCookie(tampered)).toBeNull();
  });

  it("rejects a session cookie for a non-whitelisted email", async () => {
    const cookie = await issueSessionCookie("attacker@evil.com");
    // The cookie itself signs successfully, but readSessionCookie should
    // refuse it because the email isn't on the parent allow list.
    expect(await readSessionCookie(cookie)).toBeNull();
  });

  it("returns null on missing or malformed cookies", async () => {
    expect(await readSessionCookie(undefined)).toBeNull();
    expect(await readSessionCookie("")).toBeNull();
    expect(await readSessionCookie("nodots")).toBeNull();
    expect(await readSessionCookie("only.one")).toBeNull();
    // Ill-formed: expiresAt is not a number AND signature is wrong.
    expect(await readSessionCookie("noah@x.com.notanumber.fakesig")).toBeNull();
  });

  it("handles emails containing dots (gmail.com) correctly", async () => {
    // Regression: the parser used to split on dots from the left, which
    // mis-parsed "noahhshaw@gmail.com" because of the gmail.com dot.
    const cookie = await issueSessionCookie("vaswani.anoushka@gmail.com");
    expect(await readSessionCookie(cookie)).toEqual({
      email: "vaswani.anoushka@gmail.com",
    });
  });

  it("two cookies issued back-to-back for the same email both verify", async () => {
    const c1 = await issueSessionCookie("noahhshaw@gmail.com");
    const c2 = await issueSessionCookie("noahhshaw@gmail.com");
    expect(await readSessionCookie(c1)).toEqual({
      email: "noahhshaw@gmail.com",
    });
    expect(await readSessionCookie(c2)).toEqual({
      email: "noahhshaw@gmail.com",
    });
  });
});
