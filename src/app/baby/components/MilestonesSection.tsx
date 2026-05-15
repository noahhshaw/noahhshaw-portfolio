"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Status = "pending" | "complete" | "skipped";

type Row = {
  key: string;
  displayName: string;
  category: string;
  ageWindowLowDays: number;
  ageWindowHighDays: number;
  sourceUrl: string;
  clinicalNote: string | null;
  seedOrder: number;
  status: Status;
  observedDate: string | null;
  completedAt: string | null;
  skippedAt: string | null;
  notes: string | null;
  pastWindow: boolean;
};

const CATEGORY_LABELS: Record<string, string> = {
  "social-emotional": "Social & emotional",
  "language-communication": "Language & communication",
  cognitive: "Cognitive",
  "movement-gross": "Movement — gross motor",
  "movement-fine": "Movement — fine motor",
};

const TABS: Status[] = ["pending", "complete", "skipped"];

type Props = {
  /** From the page-level query string. Highlights a row briefly when set. */
  focusKey?: string | null;
  justAction?: string | null;
};

export function MilestonesSection({ focusKey, justAction }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Status>("pending");
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const focusRef = useRef<HTMLLIElement | null>(null);

  async function refresh() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/baby/milestones");
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
      const data = await res.json();
      setRows(data.rows ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  // Scroll the just-mutated row into view after first load.
  useEffect(() => {
    if (!focusKey || loading) return;
    if (focusRef.current) {
      focusRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [focusKey, loading, rows.length]);

  const grouped = useMemo(() => {
    const inTab = rows.filter((r) => r.status === tab);
    const map = new Map<string, Row[]>();
    for (const r of inTab) {
      const list = map.get(r.category) ?? [];
      list.push(r);
      map.set(r.category, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [rows, tab]);

  async function mutate(key: string, patch: Record<string, unknown>) {
    setSavingKey(key);
    try {
      const res = await fetch(`/api/baby/milestones/${key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingKey(null);
    }
  }

  async function copyText() {
    const inTab = rows.filter((r) => r.status === tab);
    const text = inTab
      .map((r) => {
        const date =
          r.observedDate ?? r.completedAt?.slice(0, 10) ?? "";
        const dateBit =
          r.status === "complete" && date ? ` — completed ${date}` : "";
        const notes = r.notes ? ` — ${r.notes}` : "";
        return `${r.displayName}${dateBit}${notes}`;
      })
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      window.prompt("Copy this text:", text);
    }
  }

  function downloadCsv() {
    window.location.href = `/api/baby/milestones/export?format=csv&status=${tab}`;
  }

  const tabCounts = useMemo(() => {
    const c: Record<Status, number> = { pending: 0, complete: 0, skipped: 0 };
    for (const r of rows) c[r.status] += 1;
    return c;
  }, [rows]);

  return (
    <section
      className="mb-10 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
      id="milestones"
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Developmental milestones
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            CDC 2022 / AAP HealthyChildren milestone set. Mark items as you
            see them. Past-window items stay surfaced (worth raising at the
            next pediatrician visit, not necessarily concerning).
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={copyText}
            className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
          >
            Copy as text
          </button>
          <button
            type="button"
            onClick={downloadCsv}
            className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
          >
            Download CSV
          </button>
        </div>
      </div>

      {justAction && focusKey && (
        <div className="mb-4 rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          {justAction === "complete"
            ? "Marked complete."
            : justAction === "skip"
            ? "Marked skipped."
            : justAction === "reset"
            ? "Reset to pending."
            : `Updated.`}
          {focusKey ? ` Scroll down to the highlighted row to add notes.` : ""}
        </div>
      )}

      <div className="mb-4 flex gap-2 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm capitalize ${
              tab === t
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            {t}{" "}
            <span className="ml-1 text-xs text-gray-500">
              ({tabCounts[t]})
            </span>
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-gray-500">Loading…</p>}
      {err && <p className="text-sm text-red-600">{err}</p>}

      {!loading && grouped.length === 0 && (
        <p className="text-sm text-gray-500">
          No {tab} milestones right now.
        </p>
      )}

      {grouped.map(([category, rowsInCat]) => (
        <div key={category} className="mb-6">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            {CATEGORY_LABELS[category] ?? category}
          </h3>
          <ul className="divide-y divide-gray-100 border border-gray-100 rounded">
            {rowsInCat.map((r) => {
              const isFocused = r.key === focusKey;
              return (
                <li
                  key={r.key}
                  ref={isFocused ? focusRef : null}
                  className={`p-4 ${
                    isFocused ? "bg-yellow-50" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="font-medium text-gray-900">
                          {r.displayName}
                        </span>
                        {r.pastWindow && (
                          <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                            past expected window
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-gray-500">
                        AAP window: day {r.ageWindowLowDays}–
                        {r.ageWindowHighDays} ·{" "}
                        <a
                          href={r.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-700 hover:underline"
                        >
                          source
                        </a>
                      </div>
                      {r.clinicalNote && (
                        <p className="mt-1 text-xs text-gray-600">
                          {r.clinicalNote}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 text-right">
                      {r.status !== "complete" && (
                        <button
                          type="button"
                          disabled={savingKey === r.key}
                          onClick={() => mutate(r.key, { status: "complete" })}
                          className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          Mark complete
                        </button>
                      )}
                      {r.status !== "skipped" && (
                        <button
                          type="button"
                          disabled={savingKey === r.key}
                          onClick={() => mutate(r.key, { status: "skipped" })}
                          className="rounded border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
                        >
                          Skip
                        </button>
                      )}
                      {r.status !== "pending" && (
                        <button
                          type="button"
                          disabled={savingKey === r.key}
                          onClick={() => mutate(r.key, { status: "pending" })}
                          className="rounded border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
                        >
                          Reset to pending
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label className="block text-xs">
                      <span className="block text-gray-500">Observed date</span>
                      <input
                        type="date"
                        defaultValue={r.observedDate ?? ""}
                        onBlur={(e) => {
                          const v = e.target.value || null;
                          if (v !== r.observedDate) {
                            mutate(r.key, { observedDate: v });
                          }
                        }}
                        className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                      />
                    </label>
                    <label className="block text-xs">
                      <span className="block text-gray-500">Notes</span>
                      <input
                        type="text"
                        defaultValue={r.notes ?? ""}
                        placeholder="optional"
                        onBlur={(e) => {
                          const v = e.target.value || null;
                          if (v !== r.notes) {
                            mutate(r.key, { notes: v });
                          }
                        }}
                        className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                      />
                    </label>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}
