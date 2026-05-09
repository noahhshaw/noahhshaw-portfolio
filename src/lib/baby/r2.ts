import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Cloudflare R2 client. R2 is S3-compatible and uses an account-scoped
// endpoint: https://<account_id>.r2.cloudflarestorage.com
//
// Env vars required:
//   R2_ACCOUNT_ID
//   R2_ACCESS_KEY_ID
//   R2_SECRET_ACCESS_KEY
//   R2_BUCKET
//   R2_PUBLIC_BASE_URL  (optional; if a custom domain is configured)

let _client: S3Client | null = null;

function getClient(): S3Client {
  if (_client) return _client;
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 credentials are not configured");
  }
  _client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    // R2 returns 403 with text/plain bodies when SigV4 is computed against
    // virtual-hosted-style URLs (bucket-as-subdomain). Force path-style:
    //   https://<account>.r2.cloudflarestorage.com/<bucket>/<key>
    forcePathStyle: true,
  });
  return _client;
}

export function isR2Configured(): boolean {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET
  );
}

export async function uploadBytes(opts: {
  key: string;
  bytes: Uint8Array | Buffer;
  contentType: string;
  metadata?: Record<string, string>;
}): Promise<void> {
  const bucket = process.env.R2_BUCKET!;
  await getClient().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: opts.key,
      Body: opts.bytes,
      ContentType: opts.contentType,
      Metadata: opts.metadata,
    })
  );
}

// 15-min presigned PUT URL for direct browser uploads from the dashboard.
export async function presignUpload(opts: {
  key: string;
  contentType: string;
  contentLength?: number;
}): Promise<string> {
  const bucket = process.env.R2_BUCKET!;
  return getSignedUrl(
    getClient(),
    new PutObjectCommand({
      Bucket: bucket,
      Key: opts.key,
      ContentType: opts.contentType,
      ContentLength: opts.contentLength,
    }),
    { expiresIn: 60 * 15 }
  );
}

// 1-hour presigned GET URL for fetching photos in the dashboard.
export async function presignDownload(key: string): Promise<string> {
  const bucket = process.env.R2_BUCKET!;
  if (process.env.R2_PUBLIC_BASE_URL) {
    return `${process.env.R2_PUBLIC_BASE_URL}/${key}`;
  }
  return getSignedUrl(
    getClient(),
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: 60 * 60 }
  );
}

export function makePhotoKey(opts: {
  uploadedByEmail: string;
  filename: string;
  takenAt?: Date;
}): string {
  const stamp = (opts.takenAt ?? new Date()).toISOString().replace(/[:.]/g, "-");
  const safeFilename = opts.filename
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .slice(0, 80);
  const senderShort = opts.uploadedByEmail
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 24);
  return `photos/${stamp}-${senderShort}-${safeFilename}`;
}
