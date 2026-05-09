import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { emailReplies } from "@/db/schema";
import { desc } from "drizzle-orm";
import { getCurrentParent } from "@/lib/baby/session";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const parent = await getCurrentParent();
  if (!parent) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const limit = Math.min(
    100,
    Number(request.nextUrl.searchParams.get("limit") ?? "30")
  );
  const rows = await db
    .select({
      id: emailReplies.id,
      receivedAt: emailReplies.receivedAt,
      fromEmail: emailReplies.fromEmail,
      subject: emailReplies.subject,
      bodyText: emailReplies.bodyText,
      classification: emailReplies.classification,
      actionTaken: emailReplies.actionTaken,
      processedAt: emailReplies.processedAt,
      processingError: emailReplies.processingError,
    })
    .from(emailReplies)
    .orderBy(desc(emailReplies.receivedAt))
    .limit(limit);
  return NextResponse.json({ replies: rows });
}
