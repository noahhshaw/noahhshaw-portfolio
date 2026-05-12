import { BABY_PARENT_EMAILS, BABY_REPLY_TO_EMAIL } from "./constants";

// The reply attribution rule, encoded in one place so it can be tested.
//
// Rule (from the product spec):
//   Response goes only to the union of (To + Cc + From) of the inbound
//   message(s), MINUS the agent's own address, MINUS any other on-domain
//   addresses that aren't in the parent allow-list (defensive against
//   things like bounce@ aliases).
//
// Examples:
//   - Anoushka emails just the agent → reply to Anoushka only.
//   - Anoushka replies-all (To: agent + Noah) → reply to Anoushka + Noah.
//   - Multiple inbound replies merged via debouncing → union of all
//     senders/recipients.

export type InboundLike = {
  fromEmail: string;
  toEmails: string[];
  ccEmails: string[];
};

export function computeReplyRecipients(
  replies: InboundLike[],
  options?: {
    agentAddress?: string;
    parentAllowList?: readonly string[];
    agentDomain?: string;
  }
): string[] {
  const agent = (options?.agentAddress ?? BABY_REPLY_TO_EMAIL).toLowerCase();
  const allowList = (options?.parentAllowList ?? BABY_PARENT_EMAILS).map((e) =>
    e.toLowerCase()
  );
  const agentDomain =
    options?.agentDomain ?? agent.split("@")[1]?.toLowerCase() ?? "";

  const set = new Set<string>();
  for (const r of replies) {
    set.add(r.fromEmail.toLowerCase());
    for (const e of r.toEmails) set.add(e.toLowerCase());
    for (const e of r.ccEmails) set.add(e.toLowerCase());
  }
  set.delete(agent);
  // Strip on-domain addresses that aren't allow-listed parents (e.g.,
  // bounce@, no-reply@, daily-baby@ aliases).
  if (agentDomain) {
    for (const e of Array.from(set)) {
      if (e.endsWith(`@${agentDomain}`) && !allowList.includes(e)) {
        set.delete(e);
      }
    }
  }
  return Array.from(set);
}

// Plain-text → minimal HTML wrapper for replies that come back without HTML.
export function plainToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;line-height:1.6;color:#1f2937;white-space:pre-wrap">${escaped}</div>`;
}
