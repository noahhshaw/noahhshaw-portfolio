"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Row = {
  id: number;
  ageInDays: number;
  weekIndex: number;
  subject: string;
  status: string;
  validationIssues: string[];
  costUsd: string | null;
};

const STATUS_BADGES: Record<string, string> = {
  draft: "bg-amber-50 text-amber-800",
  approved: "bg-emerald-50 text-emerald-800",
  rejected: "bg-gray-100 text-gray-600",
  sent: "bg-blue-50 text-blue-800",
  stale: "bg-purple-50 text-purple-800",
};

export function PrecomputedSection() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  async function refresh() {
    setLoading(true);
    const res = await fetch("/api/baby/precomputed");
    const data = await res.json();
    setRows(data.rows ?? []);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  const counts: Record<string, number> = {
    draft: 0,
    approved: 0,
    sent: 0,
    rejected: 0,
    stale: 0,
  };
  for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1;
  const totalCost = rows.reduce((acc, r) => acc + Number(r.costUsd ?? 0), 0);

  const filtered =
    filter === "all" ? rows : rows.filter((r) => r.status === filter);
  const flaggedCount = rows.filter(
    (r) => r.validationIssues && r.validationIssues.length > 0
  ).length;

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:col-span-2">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">
          Pre-computed daily emails
        </h2>
        <button
          onClick={refresh}
          className="text-[10px] text-gray-500 hover:text-gray-900"
        >
          Refresh
        </button>
      </div>

      <div className="mb-3 flex flex-wrap gap-2 text-[11px]">
        {(["all", "draft", "approved", "sent", "rejected", "stale"] as const).map(
          (s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={
                filter === s
                  ? "rounded bg-gray-900 px-2 py-0.5 text-white"
                  : "rounded border border-gray-300 px-2 py-0.5 text-gray-700"
              }
            >
              {s}
              {s !== "all" && counts[s] !== undefined && (
                <span className="ml-1 text-gray-400">({counts[s]})</span>
              )}
              {s === "all" && (
                <span className="ml-1 text-gray-400">({rows.length})</span>
              )}
            </button>
          )
        )}
        <span className="ml-auto text-[10px] text-gray-500">
          flagged: {flaggedCount} • total cost: ${totalCost.toFixed(4)}
        </span>
      </div>

      {loading ? (
        <p className="text-xs text-gray-500">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-gray-500">
          {rows.length === 0
            ? "No pre-computed emails yet. Run `npm run precompute` from your terminal."
            : "No rows match this filter."}
        </p>
      ) : (
        <div className="max-h-96 overflow-y-auto rounded border border-gray-100">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 text-[10px] uppercase tracking-wide text-gray-600">
              <tr>
                <th className="px-2 py-1 text-left">Day</th>
                <th className="px-2 py-1 text-left">Subject</th>
                <th className="px-2 py-1 text-left">Status</th>
                <th className="px-2 py-1 text-left">Issues</th>
                <th className="px-2 py-1"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-gray-100">
                  <td className="px-2 py-1.5 text-xs font-medium text-gray-700">
                    Day {r.ageInDays}
                  </td>
                  <td className="px-2 py-1.5 text-xs text-gray-800">
                    <span className="line-clamp-1 max-w-md">{r.subject}</span>
                  </td>
                  <td className="px-2 py-1.5">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] ${
                        STATUS_BADGES[r.status] ?? "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-[10px] text-gray-600">
                    {r.validationIssues && r.validationIssues.length > 0 ? (
                      <span title={r.validationIssues.join("\n")}>
                        {r.validationIssues.length} issue
                        {r.validationIssues.length === 1 ? "" : "s"}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <Link
                      href={`/baby/precomputed/${r.id}`}
                      className="text-[10px] text-blue-700 hover:underline"
                    >
                      Review
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
