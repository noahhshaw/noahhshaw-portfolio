"use client";

import { useEffect, useState } from "react";

type ReplyRow = {
  id: number;
  receivedAt: string;
  fromEmail: string;
  subject: string | null;
  bodyText: string | null;
  classification: string | null;
  actionTaken: string | null;
  processedAt: string | null;
  processingError: string | null;
};

const ACTION_BADGES: Record<string, string> = {
  replied: "bg-emerald-50 text-emerald-700",
  "stored-context": "bg-blue-50 text-blue-700",
  "queued-kb-update": "bg-purple-50 text-purple-700",
  silent: "bg-gray-100 text-gray-600",
  "send-failed": "bg-red-50 text-red-700",
};

export function ReplyLogSection() {
  const [rows, setRows] = useState<ReplyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  async function refresh() {
    setLoading(true);
    const res = await fetch("/api/baby/replies");
    const data = await res.json();
    setRows(data.replies ?? []);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:col-span-2">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Reply log</h2>
        <button
          onClick={refresh}
          className="text-[10px] text-gray-500 hover:text-gray-900"
        >
          Refresh
        </button>
      </div>
      {loading ? (
        <p className="text-xs text-gray-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-gray-500">
          No replies yet. When you reply to a daily email, the agent&apos;s
          decisions show here.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 text-sm">
          {rows.map((r) => {
            const expanded = expandedId === r.id;
            return (
              <li key={r.id} className="py-2">
                <button
                  onClick={() => setExpandedId(expanded ? null : r.id)}
                  className="flex w-full items-start justify-between text-left"
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-700">
                        {new Date(r.receivedAt).toLocaleString()}
                      </span>
                      <span className="text-xs text-gray-500">
                        {r.fromEmail.split("@")[0]}
                      </span>
                      {r.classification && (
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-700">
                          {r.classification}
                        </span>
                      )}
                      {r.actionTaken && (
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] ${
                            ACTION_BADGES[r.actionTaken] ??
                            "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {r.actionTaken}
                        </span>
                      )}
                      {!r.processedAt && (
                        <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700">
                          pending
                        </span>
                      )}
                      {r.processingError && (
                        <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] text-red-700">
                          error
                        </span>
                      )}
                    </div>
                    {r.subject && (
                      <p className="mt-0.5 truncate text-xs text-gray-600">
                        {r.subject}
                      </p>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-400">
                    {expanded ? "▾" : "▸"}
                  </span>
                </button>
                {expanded && (
                  <div className="mt-2 rounded bg-gray-50 p-2 text-xs text-gray-700">
                    {r.bodyText ? (
                      <pre className="whitespace-pre-wrap font-sans">
                        {r.bodyText}
                      </pre>
                    ) : (
                      <em>No plain-text body.</em>
                    )}
                    {r.processingError && (
                      <p className="mt-2 text-red-700">
                        Error: {r.processingError}
                      </p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
