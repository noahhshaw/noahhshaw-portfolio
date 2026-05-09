import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { photos } from "@/db/schema";
import { getCurrentParent } from "@/lib/baby/session";
import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";
import { isR2Configured } from "@/lib/baby/r2";

export const runtime = "nodejs";

// POST /api/baby/photos/confirm
// Body: { key, mimeType, sizeBytes, takenAt?, caption?, tags? }
//
// Verifies the object actually exists in R2 (HEAD) before inserting the
// photos row. This is what prevents orphan rows when the upload PUT fails.

type Body = {
  key: string;
  mimeType: string;
  sizeBytes: number;
  takenAt?: string;
  caption?: string;
  tags?: string[];
};

export async function POST(request: NextRequest) {
  const parent = await getCurrentParent();
  if (!parent) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!isR2Configured()) {
    return NextResponse.json({ error: "R2 not configured" }, { status: 503 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.key || !body.mimeType || !body.sizeBytes) {
    return NextResponse.json(
      { error: "key, mimeType, sizeBytes required" },
      { status: 400 }
    );
  }

  // Verify the object exists in R2.
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
    forcePathStyle: true,
  });
  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: process.env.R2_BUCKET!,
        Key: body.key,
      })
    );
  } catch (err) {
    return NextResponse.json(
      {
        error: "object not found in R2",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 404 }
    );
  }

  const takenAt = body.takenAt ? new Date(body.takenAt) : undefined;
  const inserted = await db
    .insert(photos)
    .values({
      r2Key: body.key,
      mimeType: body.mimeType,
      sizeBytes: body.sizeBytes,
      takenAt: takenAt ?? null,
      uploadedByEmail: parent.email,
      caption: body.caption ?? null,
      tags: body.tags ?? [],
    })
    .returning();

  return NextResponse.json({ photoId: inserted[0].id });
}
