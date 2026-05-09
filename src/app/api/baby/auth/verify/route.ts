import { NextRequest, NextResponse } from "next/server";
import { verifyMagicLink, SESSION_COOKIE_NAME } from "@/lib/baby/auth";
import { SESSION_TTL_SECONDS } from "@/lib/baby/constants";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/baby/login?error=missing", request.url));
  }

  const result = await verifyMagicLink(token);
  if (!result.ok) {
    return NextResponse.redirect(
      new URL(`/baby/login?error=${result.reason}`, request.url)
    );
  }

  const response = NextResponse.redirect(new URL("/baby", request.url));
  response.cookies.set(SESSION_COOKIE_NAME, result.cookie, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return response;
}
