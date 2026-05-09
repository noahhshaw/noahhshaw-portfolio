import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { photos } from "@/db/schema";
import { getCurrentParent } from "@/lib/baby/session";
import { isR2Configured, makePhotoKey, presignUpload } from "@/lib/baby/r2";

export const runtime = "nodejs";

// POST /api/baby/photos/upload-url
// Body: { filename, contentType, sizeBytes, takenAt?, caption?, tags? }
// Returns: { uploadUrl, key, photoId }
//
// Two-step pattern: client requests a signed URL, then PUTs the bytes
// directly to R2. We pre-create the photos row in 'pending' state and
// the client confirms upload separately.

type Body = {
  filename: string;
  contentType: string;
  sizeBytes: number;
  takenAt?: string;
  caption?: string;
  tags?: string[];
};

export async function POST(request: NextRequest) {
  const parent = await getCurrentParent();
  if (!parent) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!isR2Configured()) {
    return NextResponse.json(
      { error: "R2 not configured" },
      { status: 503 }
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (!body.filename || !body.contentType || !body.sizeBytes) {
    return NextResponse.json(
      { error: "filename, contentType, sizeBytes required" },
      { status: 400 }
    );
  }
  if (body.sizeBytes > 25 * 1024 * 1024) {
    return NextResponse.json({ error: "file too large (25MB max)" }, { status: 413 });
  }
  if (!body.contentType.startsWith("image/")) {
    return NextResponse.json(
      { error: "only image/* uploads supported" },
      { status: 400 }
    );
  }

  const takenAt = body.takenAt ? new Date(body.takenAt) : undefined;
  const key = makePhotoKey({
    uploadedByEmail: parent.email,
    filename: body.filename,
    takenAt,
  });

  const uploadUrl = await presignUpload({
    key,
    contentType: body.contentType,
    contentLength: body.sizeBytes,
  });

  const inserted = await db
    .insert(photos)
    .values({
      r2Key: key,
      mimeType: body.contentType,
      sizeBytes: body.sizeBytes,
      takenAt: takenAt ?? null,
      uploadedByEmail: parent.email,
      caption: body.caption ?? null,
      tags: body.tags ?? [],
    })
    .returning();

  return NextResponse.json({
    uploadUrl,
    key,
    photoId: inserted[0].id,
  });
}
