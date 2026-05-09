// Helpers for parsing fields from the Resend inbound webhook payload.
// Extracted so the parser can be tested without spinning up the full route.

export function extractEmail(v: unknown): string | undefined {
  if (!v) return undefined;
  if (typeof v === "string") return v;
  if (typeof v === "object" && v !== null && "email" in v) {
    const e = (v as { email?: unknown }).email;
    return typeof e === "string" ? e : undefined;
  }
  return undefined;
}

export function extractEmailList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    const e = extractEmail(item);
    if (e) out.push(e.toLowerCase());
  }
  return out;
}
