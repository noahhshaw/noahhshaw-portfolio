// Standalone Svix-style HMAC-SHA256 webhook signature verification.
// Resend signs inbound webhooks using Svix's spec; this verifies one signed
// header set against a secret.
//
// Header format reminder:
//   svix-id:        msg_xxx
//   svix-timestamp: 1234567890
//   svix-signature: "v1,base64sig v1,base64sig"  (space-separated versions)
//
// To-sign string:   `${id}.${timestamp}.${rawBody}`
// Secret:           base64-decode the part after `whsec_`.

export type SvixVerifyInput = {
  secret: string;
  id: string | null;
  timestamp: string | null;
  signature: string | null;
  body: string;
};

export async function verifySvixSignature(
  opts: SvixVerifyInput
): Promise<boolean> {
  if (!opts.id || !opts.timestamp || !opts.signature) return false;
  const toSign = `${opts.id}.${opts.timestamp}.${opts.body}`;
  let secretBytes: Uint8Array;
  try {
    secretBytes = base64Decode(opts.secret.replace(/^whsec_/, ""));
  } catch {
    return false;
  }
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(toSign)
  );
  const expected = base64Encode(new Uint8Array(sig));
  return opts.signature
    .split(" ")
    .some((part) => part.split(",")[1] === expected);
}

// Compute the signature server-to-server, used in tests and for any code
// that needs to mint a signed request (we don't, but it's tiny and useful
// to keep with the verifier).
export async function signSvix(opts: {
  secret: string;
  id: string;
  timestamp: string;
  body: string;
}): Promise<string> {
  const toSign = `${opts.id}.${opts.timestamp}.${opts.body}`;
  const secretBytes = base64Decode(opts.secret.replace(/^whsec_/, ""));
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(toSign)
  );
  return `v1,${base64Encode(new Uint8Array(sig))}`;
}

function base64Decode(s: string): Uint8Array {
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function base64Encode(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
