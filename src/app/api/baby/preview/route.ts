import { NextResponse } from "next/server";
import { getCurrentParent } from "@/lib/baby/session";
import { loadAgeContext } from "@/lib/baby/age";
import { renderFallback, loadProfile } from "@/lib/baby/render-fallback";

export const runtime = "nodejs";

// Read-only preview of what the cron-fallback would render right now.
// Does NOT call Anthropic and does NOT send an email — purely a dry run
// against the local KB + DB state. Useful for sanity-checking before the
// next 7am cron, and for validating tone after KB changes.

export async function GET() {
  const parent = await getCurrentParent();
  if (!parent) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const profile = await loadProfile();
  if (!profile) {
    return NextResponse.json(
      { error: "baby_profile not seeded" },
      { status: 500 }
    );
  }
  const age = await loadAgeContext();
  if (!age) {
    return NextResponse.json(
      { error: "could not load age context" },
      { status: 500 }
    );
  }
  const render = await renderFallback(age, profile);
  return NextResponse.json({
    note: "This is the cron-fallback render only. The Claude routine produces richer content; this preview never calls the API.",
    age,
    subject: render.subject,
    html: render.html,
    text: render.text,
    citations: render.citations,
  });
}
