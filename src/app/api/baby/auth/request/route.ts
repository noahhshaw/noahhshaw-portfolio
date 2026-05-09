import { NextRequest, NextResponse } from "next/server";
import { requestMagicLink } from "@/lib/baby/auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let email: string | undefined;
  try {
    const body = await request.json();
    email = body?.email;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "email required" }, { status: 400 });
  }

  const origin = request.nextUrl.origin;
  const result = await requestMagicLink(email, origin);

  if (!result.ok && result.reason === "not-whitelisted") {
    // Don't leak which emails are whitelisted. Return a generic ok.
    return NextResponse.json({ ok: true });
  }
  if (!result.ok) {
    return NextResponse.json(
      { error: "could not send link" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
