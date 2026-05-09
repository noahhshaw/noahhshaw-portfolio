"use client";

import { useEffect, useState } from "react";

type PhotoItem = {
  id: number;
  caption: string | null;
  tags: string[];
  mimeType: string;
  sizeBytes: number;
  takenAt: string | null;
  uploadedAt: string;
  uploadedByEmail: string;
  url: string | null;
};

export function PhotoSection() {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [r2Configured, setR2Configured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [tagsInput, setTagsInput] = useState("");

  async function refresh() {
    setLoading(true);
    const res = await fetch("/api/baby/photos");
    const data = await res.json();
    setPhotos(data.photos ?? []);
    setR2Configured(!!data.r2Configured);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setErr(null);
    try {
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const presign = await fetch("/api/baby/photos/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          sizeBytes: file.size,
          caption: caption || undefined,
          tags: tags.length > 0 ? tags : undefined,
        }),
      });
      if (!presign.ok) {
        const data = await presign.json().catch(() => ({}));
        setErr(data.error ?? "could not get upload URL");
        return;
      }
      const { uploadUrl } = (await presign.json()) as { uploadUrl: string };
      const put = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!put.ok) {
        setErr(`R2 upload failed: ${put.status}`);
        return;
      }
      setCaption("");
      setTagsInput("");
      e.target.value = "";
      await refresh();
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:col-span-2">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Photos</h2>
        {!r2Configured && (
          <span className="text-[10px] text-amber-700">
            R2 not configured — set R2_* env vars to enable uploads.
          </span>
        )}
      </div>

      <div className="mb-4 rounded border border-gray-100 bg-gray-50 p-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Caption (optional)"
            className="rounded border border-gray-300 px-2 py-1.5 text-sm sm:col-span-2"
          />
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="Tags, comma-separated"
            className="rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
        <input
          type="file"
          accept="image/*"
          onChange={onFile}
          disabled={uploading || !r2Configured}
          className="mt-2 block text-sm"
        />
        {err && <p className="mt-2 text-xs text-red-700">{err}</p>}
        {uploading && <p className="mt-2 text-xs text-gray-500">Uploading…</p>}
      </div>

      {loading ? (
        <p className="text-xs text-gray-500">Loading…</p>
      ) : photos.length === 0 ? (
        <p className="text-xs text-gray-500">
          No photos yet. Drop an image above or reply to a daily email with one
          attached.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {photos.map((p) => (
            <figure
              key={p.id}
              className="relative aspect-square overflow-hidden rounded border border-gray-200 bg-gray-100"
            >
              {p.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.url}
                  alt={p.caption ?? ""}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-[10px] text-gray-400">
                  no preview
                </div>
              )}
              {p.caption && (
                <figcaption className="absolute bottom-0 left-0 right-0 truncate bg-black/50 px-1.5 py-1 text-[10px] text-white">
                  {p.caption}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}
