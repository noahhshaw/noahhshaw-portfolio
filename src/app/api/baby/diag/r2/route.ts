import { NextResponse } from "next/server";
import { db } from "@/db";
import { photos } from "@/db/schema";
import { desc } from "drizzle-orm";
import { isR2Configured, presignDownload } from "@/lib/baby/r2";
import { getCurrentParent } from "@/lib/baby/session";

export const runtime = "nodejs";
export const maxDuration = 30;

// Server-side R2 inspection. Hits each photo's presigned URL with HEAD and
// reports the HTTP status. Diagnoses sign/permission/missing-object issues
// without exposing presigned URLs to the client.
//
// Auth: parent session cookie (log into /baby first).

export async function GET() {
  const parent = await getCurrentParent();
  if (!parent) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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

  return NextResponse.json({ config, photos: results });
}
