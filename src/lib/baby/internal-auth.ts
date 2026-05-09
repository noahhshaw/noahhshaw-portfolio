import { NextRequest, NextResponse } from "next/server";

// Shared-secret auth for internal endpoints used by the Claude routine
// and other server-to-server callers.
//
// Routine sends:  Authorization: Bearer <BABY_INTERNAL_SECRET>
//
// Returns null on success, or a NextResponse to short-circuit the handler.

export function checkInternalAuth(request: NextRequest): NextResponse | null {
  const expected = process.env.BABY_INTERNAL_SECRET;
  if (!expected) {
    // Fail closed in production; allow only in dev so endpoints are testable.
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "internal auth not configured" },
        { status: 500 }
      );
    }
    return null;
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
