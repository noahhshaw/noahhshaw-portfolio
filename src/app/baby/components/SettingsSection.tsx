"use client";

import { useState } from "react";

const TOPIC_DEFS: Array<{ key: string; label: string; defaultOn: boolean }> = [
  { key: "milestones", label: "Developmental milestones", defaultOn: true },
  { key: "watch_fors", label: "Watch-fors (severity-framed)", defaultOn: true },
  { key: "calendar", label: "Calendar reminders", defaultOn: true },
  { key: "enrichment", label: "Cognitive enrichment", defaultOn: true },
  { key: "schools", label: "Preschool / school pipeline", defaultOn: true },
  { key: "dad_finance", label: "Dad: finance & family planning", defaultOn: true },
  { key: "mom_postpartum", label: "Mom: postpartum & breastfeeding", defaultOn: true },
];

type Settings = {
  voice_intensity?: number;
  enrichment_intensity?: number;
  topics_enabled?: Record<string, boolean>;
  paused_until?: string | null;
};

type Props = { initial: Record<string, unknown> };

export function SettingsSection({ initial }: Props) {
  const init = initial as Settings;
  const [voiceIntensity, setVoiceIntensity] = useState<number>(
    init.voice_intensity ?? 6
  );
  const [enrichmentIntensity, setEnrichmentIntensity] = useState<number>(
    init.enrichment_intensity ?? 8
  );
  const [topics, setTopics] = useState<Record<string, boolean>>(() => {
    const base: Record<string, boolean> = {};
    for (const t of TOPIC_DEFS) base[t.key] = t.defaultOn;
    return { ...base, ...(init.topics_enabled ?? {}) };
  });
  const [pausedUntil, setPausedUntil] = useState<string>(
    init.paused_until ?? ""
  );
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/baby/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voice_intensity: voiceIntensity,
          enrichment_intensity: enrichmentIntensity,
          topics_enabled: topics,
          paused_until: pausedUntil || null,
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
        <h2 className="text-sm font-semibold text-gray-900">Voice & topics</h2>
        {savedAt && (
          <span className="text-[10px] text-emerald-700">Saved {savedAt}</span>
        )}
      </div>

      <div className="space-y-4">
        <SliderField
          label="Voice register"
          leftLabel="Clinical"
          rightLabel="Warm"
          value={voiceIntensity}
          onChange={setVoiceIntensity}
        />
        <SliderField
          label="Enrichment intensity"
          leftLabel="Moderate"
          rightLabel="Tiger mom"
          value={enrichmentIntensity}
          onChange={setEnrichmentIntensity}
        />

        <div>
          <span className="mb-2 block text-[11px] uppercase tracking-wide text-gray-500">
            Topics enabled
          </span>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {TOPIC_DEFS.map((t) => (
              <label
                key={t.key}
                className="flex items-center gap-2 text-sm text-gray-700"
              >
                <input
                  type="checkbox"
                  checked={!!topics[t.key]}
                  onChange={(e) =>
                    setTopics((prev) => ({ ...prev, [t.key]: e.target.checked }))
                  }
                />
                {t.label}
              </label>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="mb-1 block text-[11px] uppercase tracking-wide text-gray-500">
            Pause sends until
          </span>
          <input
            type="date"
            value={pausedUntil}
            onChange={(e) => setPausedUntil(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-gray-500 focus:outline-none"
          />
        </label>
      </div>

      {err && <p className="mt-2 text-xs text-red-700">{err}</p>}
      <button
        onClick={save}
        disabled={saving}
        className="mt-3 rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save settings"}
      </button>
    </section>
  );
}

function SliderField({
  label,
  leftLabel,
  rightLabel,
  value,
  onChange,
}: {
  label: string;
  leftLabel: string;
  rightLabel: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <span className="mb-1 block text-[11px] uppercase tracking-wide text-gray-500">
        {label}
      </span>
      <input
        type="range"
        min={0}
        max={10}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
      <div className="flex justify-between text-[10px] text-gray-500">
        <span>{leftLabel}</span>
        <span className="font-medium text-gray-700">{value}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  );
}
