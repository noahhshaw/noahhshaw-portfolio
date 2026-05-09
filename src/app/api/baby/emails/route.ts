import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { dailyEmails } from "@/db/schema";
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
      id: dailyEmails.id,
      sentDate: dailyEmails.sentDate,
      sentAt: dailyEmails.sentAt,
      ageInDays: dailyEmails.ageInDays,
      subject: dailyEmails.subject,
      sourcePath: dailyEmails.sourcePath,
      status: dailyEmails.status,
      recipients: dailyEmails.recipients,
    })
    .from(dailyEmails)
    .orderBy(desc(dailyEmails.sentAt))
    .limit(limit);

  return NextResponse.json({ emails: rows });
}
