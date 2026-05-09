"use client";

import { useState } from "react";

type PreviewResult = {
  subject: string;
  html: string;
  text: string;
  age: { ageInDays: number; weekIndex: number; status: string };
  note: string;
};

export function PreviewSection() {
  const [data, setData] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showHtml, setShowHtml] = useState(true);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/baby/preview");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErr(body.error ?? `HTTP ${res.status}`);
        return;
      }
      setData((await res.json()) as PreviewResult);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:col-span-2">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">
          Preview tomorrow&apos;s email
        </h2>
        <button
          onClick={load}
          disabled={loading}
          className="rounded bg-gray-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
        >
          {loading ? "Rendering…" : data ? "Re-render" : "Render preview"}
        </button>
      </div>
      <p className="mb-3 text-xs text-gray-500">
        Dry-runs the cron fallback render against today&apos;s KB and DB state.
        Doesn&apos;t send and doesn&apos;t call the API. The live routine output
        will be richer.
      </p>

      {err && <p className="text-xs text-red-700">{err}</p>}

      {data && (
        <div className="space-y-3">
          <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-gray-500">
              Subject
            </p>
            <p className="text-sm text-gray-900">{data.subject}</p>
            <p className="mt-1 text-[10px] text-gray-500">
              Day {data.age.ageInDays} • week {data.age.weekIndex} • {data.age.status}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowHtml(true)}
              className={
                showHtml
                  ? "rounded bg-gray-900 px-2 py-1 text-[10px] font-medium text-white"
                  : "rounded border border-gray-300 px-2 py-1 text-[10px] text-gray-700"
              }
            >
              HTML
            </button>
            <button
              onClick={() => setShowHtml(false)}
              className={
                !showHtml
                  ? "rounded bg-gray-900 px-2 py-1 text-[10px] font-medium text-white"
                  : "rounded border border-gray-300 px-2 py-1 text-[10px] text-gray-700"
              }
            >
              Plain text
            </button>
          </div>

          {showHtml ? (
            <div
              className="rounded border border-gray-200 bg-white p-3"
              dangerouslySetInnerHTML={{ __html: data.html }}
            />
          ) : (
            <pre className="whitespace-pre-wrap rounded border border-gray-200 bg-gray-50 p-3 text-xs text-gray-800">
              {data.text}
            </pre>
          )}
        </div>
      )}
    </section>
  );
}
