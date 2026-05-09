import { describe, it, expect } from "vitest";
import { signSvix, verifySvixSignature } from "../svix";

// A 32-byte secret encoded base64 (this is a test secret; not real).
const SECRET = "whsec_dGVzdHNlY3JldGZvcnVuaXR0ZXN0aW5ncHVycG9zZW9ubHk=";

async function fixture(body: string) {
  const id = "msg_test123";
  const timestamp = "1234567890";
  const sig = await signSvix({ secret: SECRET, id, timestamp, body });
  return { id, timestamp, sig, body };
}

describe("verifySvixSignature", () => {
  it("accepts a signature it just generated", async () => {
    const { id, timestamp, sig, body } = await fixture('{"hello":"world"}');
    expect(
      await verifySvixSignature({
        secret: SECRET,
        id,
        timestamp,
        signature: sig,
        body,
      })
    ).toBe(true);
  });

  it("rejects when the body has been altered", async () => {
    const { id, timestamp, sig } = await fixture('{"hello":"world"}');
    expect(
      await verifySvixSignature({
        secret: SECRET,
        id,
        timestamp,
        signature: sig,
        body: '{"hello":"WORLD"}',
      })
    ).toBe(false);
  });

  it("rejects when the timestamp has been altered", async () => {
    const { id, sig, body } = await fixture('{"hello":"world"}');
    expect(
      await verifySvixSignature({
        secret: SECRET,
        id,
        timestamp: "0",
        signature: sig,
        body,
      })
    ).toBe(false);
  });

  it("rejects when the message id has been altered", async () => {
    const { timestamp, sig, body } = await fixture('{"hello":"world"}');
    expect(
      await verifySvixSignature({
        secret: SECRET,
        id: "msg_other",
        timestamp,
        signature: sig,
        body,
      })
    ).toBe(false);
  });

  it("rejects when the secret is wrong", async () => {
    const { id, timestamp, sig, body } = await fixture('{"hello":"world"}');
    expect(
      await verifySvixSignature({
        secret: "whsec_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
        id,
        timestamp,
        signature: sig,
        body,
      })
    ).toBe(false);
  });

  it("rejects when any signing header is missing", async () => {
    const { id, timestamp, sig, body } = await fixture('{"hello":"world"}');
    expect(
      await verifySvixSignature({
        secret: SECRET,
        id: null,
        timestamp,
        signature: sig,
        body,
      })
    ).toBe(false);
    expect(
      await verifySvixSignature({
        secret: SECRET,
        id,
        timestamp: null,
        signature: sig,
        body,
      })
    ).toBe(false);
    expect(
      await verifySvixSignature({
        secret: SECRET,
        id,
        timestamp,
        signature: null,
        body,
      })
    ).toBe(false);
  });

  it("accepts a signature header containing multiple space-separated versions", async () => {
    const { id, timestamp, sig, body } = await fixture('{"hello":"world"}');
    const multi = `v1,wrongsignature ${sig}`;
    expect(
      await verifySvixSignature({
        secret: SECRET,
        id,
        timestamp,
        signature: multi,
        body,
      })
    ).toBe(true);
  });

  it("accepts the secret with or without the whsec_ prefix", async () => {
    const stripped = SECRET.replace(/^whsec_/, "");
    const { id, timestamp, sig, body } = await fixture('{"x":1}');
    expect(
      await verifySvixSignature({
        secret: stripped,
        id,
        timestamp,
        signature: sig,
        body,
      })
    ).toBe(true);
  });
});
