import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";

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
    forcePathStyle: true,
  });
  return _client;
}

export async function fetchObjectBase64(
  key: string
): Promise<{ base64: string; contentType: string } | null> {
  const bucket = process.env.R2_BUCKET;
  if (!bucket) return null;
  try {
    const result = await getClient().send(
      new GetObjectCommand({ Bucket: bucket, Key: key })
    );
    const stream = result.Body as
      | ReadableStream<Uint8Array>
      | NodeJS.ReadableStream
      | undefined;
    if (!stream) return null;
    const bytes = await streamToBytes(stream);
    return {
      base64: Buffer.from(bytes).toString("base64"),
      contentType: result.ContentType ?? "application/octet-stream",
    };
  } catch (err) {
    console.error("[r2-fetch] failed to download", key, err);
    return null;
  }
}

async function streamToBytes(
  stream: ReadableStream<Uint8Array> | NodeJS.ReadableStream
): Promise<Uint8Array> {
  if (typeof (stream as ReadableStream<Uint8Array>).getReader === "function") {
    const reader = (stream as ReadableStream<Uint8Array>).getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    return concat(chunks);
  }
  // Node.js readable
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream as NodeJS.ReadableStream) {
    chunks.push(chunk as Uint8Array);
  }
  return concat(chunks);
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}
