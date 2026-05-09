import { cookies } from "next/headers";
import { readSessionCookie, SESSION_COOKIE_NAME } from "./auth";
import { getRecipientByEmail } from "./recipients-store";

// Server-component helper: returns the authenticated parent or null.
export async function getCurrentParent() {
  const cookie = cookies().get(SESSION_COOKIE_NAME)?.value;
  const session = await readSessionCookie(cookie);
  if (!session) return null;
  const recipient = await getRecipientByEmail(session.email);
  if (!recipient) return null;
  return {
    email: session.email,
    firstName: recipient.firstName,
    role: recipient.role,
  };
}
