import { cookies } from "next/headers";
import { readSessionCookie, SESSION_COOKIE_NAME } from "./auth";
import { parentByEmail } from "./constants";

// Server-component helper: returns the authenticated parent or null.
export async function getCurrentParent() {
  const cookie = cookies().get(SESSION_COOKIE_NAME)?.value;
  const session = await readSessionCookie(cookie);
  if (!session) return null;
  const parent = parentByEmail(session.email);
  if (!parent) return null;
  return { email: session.email, firstName: parent.firstName, role: parent.role };
}
