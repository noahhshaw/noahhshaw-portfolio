"use client";

import { useEffect, useState } from "react";

type Recipient = {
  email: string;
  firstName: string;
  role: "primary" | "partner" | "guest";
  receivesDailyEmail: boolean;
};

const ROLE_OPTIONS = ["primary", "partner", "guest"] as const;

export function RecipientsSection() {
  const [rows, setRows] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // New-row form
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<Recipient["role"]>("guest");

  async function refresh() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/baby/recipients");
      const data = await res.json();
      setRows(data.recipients ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function save(next: Recipient[]) {
    setSaving(true);
    setErr(null);
    setWarning(null);
    try {
      const res = await fetch("/api/baby/recipients", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipients: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? `error ${res.status}`);
        return;
      }
      setRows(data.recipients ?? next);
      setSavedAt(new Date().toLocaleTimeString());
      if (data.warning) setWarning(data.warning);
    } finally {
      setSaving(false);
    }
  }

  function updateRow(i: number, patch: Partial<Recipient>) {
    setRows((prev) =>
      prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r))
    );
  }

  async function persistRow(i: number) {
    await save(rows);
  }

  async function removeRow(i: number) {
    if (rows.length <= 1) {
      setErr("Cannot remove the last recipient.");
      return;
    }
    if (!confirm(`Remove ${rows[i].email}?`)) return;
    const next = rows.filter((_, idx) => idx !== i);
    await save(next);
  }

  async function addRow(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail || !newName) {
      setErr("email and first name required");
      return;
    }
    const next: Recipient[] = [
      ...rows,
      {
        email: newEmail.trim().toLowerCase(),
        firstName: newName.trim(),
        role: newRole,
        receivesDailyEmail: true,
      },
    ];
    await save(next);
    if (!err) {
      setNewEmail("");
      setNewName("");
      setNewRole("guest");
    }
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:col-span-2">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">
          Recipients{" "}
          <span className="ml-1 text-[10px] font-normal text-gray-500">
            (login allowlist + daily-email subscribers)
          </span>
        </h2>
        <div className="flex items-center gap-2">
          {savedAt && (
            <span className="text-[10px] text-emerald-700">
              Saved {savedAt}
            </span>
          )}
          {saving && <span className="text-[10px] text-gray-500">Saving…</span>}
        </div>
      </div>

      {warning && (
        <div className="mb-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-900">
          {warning}
        </div>
      )}
      {err && (
        <div className="mb-2 rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-900">
          {err}
        </div>
      )}

      {loading ? (
        <p className="text-xs text-gray-500">Loading…</p>
      ) : (
        <div className="overflow-hidden rounded border border-gray-100">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-600">
              <tr>
                <th className="px-2 py-1 text-left">Email</th>
                <th className="px-2 py-1 text-left">First name</th>
                <th className="px-2 py-1 text-left">Role</th>
                <th className="px-2 py-1 text-center">Daily email</th>
                <th className="px-2 py-1"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.email} className="border-t border-gray-100">
                  <td className="px-2 py-1.5 text-gray-700">{r.email}</td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={r.firstName}
                      onChange={(e) =>
                        updateRow(i, { firstName: e.target.value })
                      }
                      onBlur={() => persistRow(i)}
                      className="w-full rounded border border-gray-200 px-1.5 py-0.5 text-xs focus:border-gray-500 focus:outline-none"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <select
                      value={r.role}
                      onChange={(e) => {
                        updateRow(i, { role: e.target.value as Recipient["role"] });
                      }}
                      onBlur={() => persistRow(i)}
                      className="rounded border border-gray-200 px-1.5 py-0.5 text-xs"
                    >
                      {ROLE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <input
                      type="checkbox"
                      checked={r.receivesDailyEmail}
                      onChange={(e) => {
                        const next = rows.map((x, idx) =>
                          idx === i
                            ? { ...x, receivesDailyEmail: e.target.checked }
                            : x
                        );
                        save(next);
                      }}
                    />
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <button
                      onClick={() => removeRow(i)}
                      className="text-[10px] text-gray-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form
        onSubmit={addRow}
        className="mt-3 grid grid-cols-1 gap-2 rounded border border-gray-100 bg-gray-50 p-3 sm:grid-cols-4"
      >
        <input
          type="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          placeholder="email@example.com"
          className="rounded border border-gray-300 px-2 py-1.5 text-sm sm:col-span-2"
        />
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="First name"
          className="rounded border border-gray-300 px-2 py-1.5 text-sm"
        />
        <div className="flex items-center gap-2">
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as Recipient["role"])}
            className="rounded border border-gray-300 px-1.5 py-1.5 text-sm"
          >
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-gray-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </form>
    </section>
  );
}
