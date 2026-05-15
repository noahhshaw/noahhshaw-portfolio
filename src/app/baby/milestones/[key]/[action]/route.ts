import { NextRequest, NextResponse } from "next/server";
import { getCurrentParent } from "@/lib/baby/session";
import {
  getDefaultBabyProfileId,
  updateMilestoneStatus,
  type MilestoneStatus,
} from "@/lib/baby/milestones";

export const runtime = "nodejs";

// One-tap state mutators reachable from inside daily emails:
//
//   GET /baby/milestones/<key>/complete   → status='complete'
//   GET /baby/milestones/<key>/skip       → status='skipped'
//   GET /baby/milestones/<key>/reset      → status='pending'
//
// On tap, flips state for the singleton baby profile, then 302-redirects
// to /baby/milestones?focus=<key>&just=<action> so the dashboard scrolls
// to + highlights the row that changed.
//
// Auth: session-required (same as the rest of /baby). Unauthenticated
// taps fall through to the login flow and return here on success.

const ACTIONS: Record<string, MilestoneStatus> = {
  complete: "complete",
  skip: "skipped",
  reset: "pending",
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string; action: string }> }
) {
  const { key, action } = await params;
  const status = ACTIONS[action];
  if (!status) {
    return NextResponse.json(
      { error: `unknown action '${action}' — expected complete|skip|reset` },
      { status: 400 }
    );
  }

  const parent = await getCurrentParent();
  if (!parent) {
    // Send them through the auth flow with this URL as the post-login
    // destination. Matches the rest of /baby.
    const next = encodeURIComponent(`/baby/milestones/${key}/${action}`);
    return NextResponse.redirect(
      new URL(`/baby/login?next=${next}`, request.nextUrl.origin)
    );
  }

  const babyId = await getDefaultBabyProfileId();
  if (!babyId) {
    return NextResponse.json(
      { error: "no baby profile configured" },
      { status: 400 }
    );
  }

  const result = await updateMilestoneStatus({
    babyProfileId: babyId,
    catalogKey: key,
    status,
    // When tapping "complete" from the email, stamp observed_date to
    // today as a reasonable default. Parent can edit on the dashboard.
    observedDate:
      status === "complete" ? new Date().toISOString().slice(0, 10) : undefined,
  });

  if (!result) {
    return NextResponse.redirect(
      new URL(`/baby/milestones?missing=${encodeURIComponent(key)}`, request.nextUrl.origin)
    );
  }

  return NextResponse.redirect(
    new URL(
      `/baby/milestones?focus=${encodeURIComponent(key)}&just=${action}`,
      request.nextUrl.origin
    )
  );
}
