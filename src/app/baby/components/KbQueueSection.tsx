"use client";

import { useEffect, useState } from "react";

type QueueRow = {
  id: number;
  requestedAt: string;
  requesterEmail: string;
  requestText: string;
  targetTopic: string | null;
  status: string;
  prUrl: string | null;
  notes: string | null;
  completedAt: string | null;
};

const STATUS_BADGES: Record<string, string> = {
  queued: "bg-amber-50 text-amber-800",
  "in-progress": "bg-blue-50 text-blue-800",
  "pr-opened": "bg-purple-50 text-purple-800",
  merged: "bg-emerald-50 text-emerald-800",
  rejected: "bg-gray-100 text-gray-600",
};

export function KbQueueSection() {
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    const res = await fetch("/api/baby/kb-queue");
    const data = await res.json();
    setRows(data.queue ?? []);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function setStatus(id: number, status: string, prUrl?: string) {
    await fetch("/api/baby/kb-queue", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status, prUrl }),
    });
    refresh();
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:col-span-2">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">
          Pending KB updates
        </h2>
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
          No requests queued. Replies asking the agent to learn or update
          something show here.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 text-sm">
          {rows.map((r) => (
            <li key={r.id} className="py-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500">
                      {new Date(r.requestedAt).toLocaleString()}
                    </span>
                    <span className="text-[10px] text-gray-500">
                      {r.requesterEmail.split("@")[0]}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] ${
                        STATUS_BADGES[r.status] ?? "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-800">{r.requestText}</p>
                  {r.prUrl && (
                    <a
                      href={r.prUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 block text-xs text-blue-700 underline-offset-2 hover:underline"
                    >
                      {r.prUrl}
                    </a>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  {r.status === "queued" && (
                    <button
                      onClick={() => setStatus(r.id, "in-progress")}
                      className="rounded border border-gray-300 px-1.5 py-0.5 text-[10px] text-gray-700"
                    >
                      Mark in-progress
                    </button>
                  )}
                  {(r.status === "queued" || r.status === "in-progress") && (
                    <button
                      onClick={() => {
                        const url = prompt("Pull request URL:");
                        if (url) setStatus(r.id, "pr-opened", url);
                      }}
                      className="rounded border border-gray-300 px-1.5 py-0.5 text-[10px] text-gray-700"
                    >
                      Add PR URL
                    </button>
                  )}
                  {r.status === "pr-opened" && (
                    <button
                      onClick={() => setStatus(r.id, "merged")}
                      className="rounded border border-emerald-300 px-1.5 py-0.5 text-[10px] text-emerald-700"
                    >
                      Mark merged
                    </button>
                  )}
                  {r.status !== "rejected" && r.status !== "merged" && (
                    <button
                      onClick={() => setStatus(r.id, "rejected")}
                      className="rounded border border-red-200 px-1.5 py-0.5 text-[10px] text-red-700"
                    >
                      Reject
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
