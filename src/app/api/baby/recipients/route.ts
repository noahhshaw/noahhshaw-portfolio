import { NextRequest, NextResponse } from "next/server";
import { getCurrentParent } from "@/lib/baby/session";
import {
  loadRecipients,
  saveRecipients,
  type Recipient,
} from "@/lib/baby/recipients-store";

export const runtime = "nodejs";

// Recipients (parent email allow list + daily-email subscribers).
// Persisted in agent_settings under key "recipients" so the list is
// editable from the dashboard without a redeploy.

export async function GET() {
  const parent = await getCurrentParent();
  if (!parent) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const recipients = await loadRecipients();
  return NextResponse.json({ recipients });
}

type PutBody = { recipients: Recipient[] };

export async function PUT(request: NextRequest) {
  const parent = await getCurrentParent();
  if (!parent) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: PutBody;
  try {
    body = (await request.json()) as PutBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!Array.isArray(body.recipients)) {
    return NextResponse.json(
      { error: "recipients array required" },
      { status: 400 }
    );
  }

  // Guardrail: the editor must remain on the list — otherwise they lock
  // themselves out on the next session refresh. Allow it but warn.
  const editorEmail = parent.email.toLowerCase();
  const editorStillPresent = body.recipients.some(
    (r) => r.email.toLowerCase() === editorEmail
  );

  const result = await saveRecipients(body.recipients, parent.email);
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    recipients: await loadRecipients(),
    warning: editorStillPresent
      ? null
      : "You removed yourself from the recipients list. Your current session is still valid, but you won't be able to log back in unless re-added.",
  });
}
