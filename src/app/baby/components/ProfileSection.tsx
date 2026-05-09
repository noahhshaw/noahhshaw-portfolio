"use client";

import { useState } from "react";
import type { BabyProfile } from "@/db/schema";

type Props = {
  initial: BabyProfile | null;
};

export function ProfileSection({ initial }: Props) {
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? "2026-05-11");
  const [birthDate, setBirthDate] = useState(initial?.birthDate ?? "");
  const [babyName, setBabyName] = useState(initial?.babyName ?? "");
  const [pediatricianName, setPediatricianName] = useState(
    initial?.pediatricianName ?? ""
  );
  const [pediatricianPhone, setPediatricianPhone] = useState(
    initial?.pediatricianPhone ?? ""
  );
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/baby/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dueDate,
          birthDate: birthDate || null,
          babyName: babyName || null,
          pediatricianName: pediatricianName || null,
          pediatricianPhone: pediatricianPhone || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErr(data.error ?? "save failed");
      } else {
        setSavedAt(new Date().toLocaleTimeString());
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Baby profile</h2>
        {savedAt && (
          <span className="text-[10px] text-emerald-700">Saved {savedAt}</span>
        )}
      </div>
      <div className="space-y-3">
        <Field label="Due date">
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Birth date (set after birth)">
          <input
            type="date"
            value={birthDate ?? ""}
            onChange={(e) => setBirthDate(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Baby name">
          <input
            type="text"
            value={babyName ?? ""}
            onChange={(e) => setBabyName(e.target.value)}
            placeholder="Set after birth"
            className={inputClass}
          />
        </Field>
        <Field label="Pediatrician">
          <input
            type="text"
            value={pediatricianName ?? ""}
            onChange={(e) => setPediatricianName(e.target.value)}
            placeholder="Name"
            className={inputClass}
          />
        </Field>
        <Field label="Pediatrician phone">
          <input
            type="tel"
            value={pediatricianPhone ?? ""}
            onChange={(e) => setPediatricianPhone(e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>
      {err && (
        <p className="mt-2 text-xs text-red-700">{err}</p>
      )}
      <button
        onClick={save}
        disabled={saving}
        className="mt-3 rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save profile"}
      </button>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-wide text-gray-500">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-gray-500 focus:outline-none";
