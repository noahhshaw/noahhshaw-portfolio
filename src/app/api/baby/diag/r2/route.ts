import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { photos } from "@/db/schema";
import { desc, inArray } from "drizzle-orm";
import { isR2Configured, presignDownload } from "@/lib/baby/r2";
import { getCurrentParent } from "@/lib/baby/session";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

export const runtime = "nodejs";
export const maxDuration = 30;

// Server-side R2 inspection. Hits each photo's presigned URL with HEAD and
// reports the HTTP status. Diagnoses sign/permission/missing-object issues
// without exposing presigned URLs to the client.
//
// Auth: parent session cookie (log into /baby first).

export async function GET(request: NextRequest) {
  const parent = await getCurrentParent();
  if (!parent) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // ?cleanup=1 → delete orphan photo rows (those whose R2 key 404s).
  // Convenient for browser-driven cleanup since DELETE isn't navigable.
  if (request.nextUrl.searchParams.get("cleanup") === "1") {
    return cleanupOrphans();
  }

  const config = {
    r2_configured: isR2Configured(),
    account_id_present: !!process.env.R2_ACCOUNT_ID,
    access_key_present: !!process.env.R2_ACCESS_KEY_ID,
    secret_key_present: !!process.env.R2_SECRET_ACCESS_KEY,
    bucket: process.env.R2_BUCKET ?? null,
    bucket_present: !!process.env.R2_BUCKET,
    public_base_url: process.env.R2_PUBLIC_BASE_URL ?? null,
  };

  if (!isR2Configured()) {
    return NextResponse.json({ config, photos: [] });
  }

  // List actual objects in the R2 bucket so we can compare against the DB
  let bucketContents: { keys: string[]; total: number; error?: string } = {
    keys: [],
    total: 0,
  };
  try {
    const client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
      forcePathStyle: true,
    });
    const result = await client.send(
      new ListObjectsV2Command({
        Bucket: process.env.R2_BUCKET!,
        MaxKeys: 50,
      })
    );
    bucketContents = {
      keys: (result.Contents ?? []).map((o) => o.Key ?? ""),
      total: result.KeyCount ?? 0,
    };
  } catch (err) {
    bucketContents.error = err instanceof Error ? err.message : String(err);
  }

  const rows = await db
    .select({
      id: photos.id,
      r2Key: photos.r2Key,
      mimeType: photos.mimeType,
      sizeBytes: photos.sizeBytes,
      uploadedByEmail: photos.uploadedByEmail,
      uploadedAt: photos.uploadedAt,
      sourceReplyId: photos.sourceReplyId,
    })
    .from(photos)
    .orderBy(desc(photos.uploadedAt))
    .limit(10);

  const results = await Promise.all(
    rows.map(async (p) => {
      let presignedUrl: string;
      try {
        presignedUrl = await presignDownload(p.r2Key);
      } catch (err) {
        return {
          ...p,
          presign_error: err instanceof Error ? err.message : String(err),
        };
      }

      // Probe with GET so we can read the error body if R2 rejects.
      let getStatus: number | null = null;
      let getError: string | null = null;
      let contentLength: string | null = null;
      let contentType: string | null = null;
      let errorBody: string | null = null;
      try {
        const res = await fetch(presignedUrl, { method: "GET" });
        getStatus = res.status;
        contentLength = res.headers.get("content-length");
        contentType = res.headers.get("content-type");
        if (!res.ok) {
          errorBody = (await res.text()).slice(0, 500);
        }
      } catch (err) {
        getError = err instanceof Error ? err.message : String(err);
      }

      // Strip query string + signature from URL for the response (don't leak signature)
      const urlNoQuery = presignedUrl.split("?")[0];

      return {
        ...p,
        url_path: urlNoQuery,
        get_status: getStatus,
        get_error: getError,
        content_length: contentLength,
        content_type: contentType,
        error_body: errorBody,
      };
    })
  );

  return NextResponse.json({ config, bucket_contents: bucketContents, photos: results });
}

// DELETE /api/baby/diag/r2 → removes photos rows whose R2 key 404s.
// Same effect as GET ?cleanup=1.
export async function DELETE() {
  const parent = await getCurrentParent();
  if (!parent) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return cleanupOrphans();
}

async function cleanupOrphans() {
  if (!isR2Configured()) {
    return NextResponse.json({ error: "R2 not configured" }, { status: 503 });
  }
  const rows = await db.select({ id: photos.id, r2Key: photos.r2Key }).from(photos);
  const orphanIds: number[] = [];
  for (const row of rows) {
    try {
      const url = await presignDownload(row.r2Key);
      const res = await fetch(url, { method: "GET" });
      if (res.status === 404) orphanIds.push(row.id);
    } catch {
      orphanIds.push(row.id);
    }
  }
  if (orphanIds.length > 0) {
    await db.delete(photos).where(inArray(photos.id, orphanIds));
  }
  return NextResponse.json({
    scanned: rows.length,
    deleted: orphanIds.length,
    orphan_ids: orphanIds,
  });
}
