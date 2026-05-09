import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { photos } from "@/db/schema";
import { desc } from "drizzle-orm";
import { getCurrentParent } from "@/lib/baby/session";
import { isR2Configured, presignDownload } from "@/lib/baby/r2";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const parent = await getCurrentParent();
  if (!parent) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const limit = Math.min(
    100,
    Number(request.nextUrl.searchParams.get("limit") ?? "30")
  );

  const rows = await db
    .select()
    .from(photos)
    .orderBy(desc(photos.takenAt), desc(photos.uploadedAt))
    .limit(limit);

  const r2Ready = isR2Configured();
  const items = await Promise.all(
    rows.map(async (p) => ({
      id: p.id,
      caption: p.caption,
      tags: p.tags,
      mimeType: p.mimeType,
      sizeBytes: p.sizeBytes,
      takenAt: p.takenAt,
      uploadedAt: p.uploadedAt,
      uploadedByEmail: p.uploadedByEmail,
      url: r2Ready ? await presignDownload(p.r2Key) : null,
    }))
  );

  return NextResponse.json({ photos: items, r2Configured: r2Ready });
}
