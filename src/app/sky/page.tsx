"use client";

import { useState } from "react";
import SkyCanvas from "./SkyCanvas";

// MVP: lock observation time to May 21st, 2026, 22:00 local-ish (use UTC offset implicit).
const FIXED_DATE = new Date("2026-05-21T22:00:00");

export default function SkyPage() {
  const [address, setAddress] = useState("");
  const [loc, setLoc] = useState<{ lat: number; lon: number; label: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim()) return;
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch(`/api/geocode?q=${encodeURIComponent(address)}`);
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || "lookup failed");
      }
      const d = await r.json();
      setLoc({ lat: d.lat, lon: d.lon, label: d.label });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "lookup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-slate-100 flex flex-col">
      <header className="p-4 border-b border-slate-800">
        <h1 className="text-xl font-semibold">Night Sky</h1>
        <p className="text-sm text-slate-400">
          Enter a street address to see the sky overhead on May 21, 2026, 10pm.
        </p>
        <form onSubmit={submit} className="mt-3 flex gap-2">
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="1600 Pennsylvania Ave NW, Washington DC"
            className="flex-1 max-w-xl px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 rounded text-sm"
          >
            {loading ? "…" : "Look up"}
          </button>
        </form>
        {err && <p className="text-red-400 text-sm mt-2">{err}</p>}
      </header>
      <div className="flex-1 relative">
        {loc ? (
          <SkyCanvas lat={loc.lat} lon={loc.lon} date={FIXED_DATE} label={loc.label} />
        ) : (
          <div className="flex items-center justify-center h-full text-slate-500 text-sm">
            Enter an address above to render the night sky.
          </div>
        )}
      </div>
    </main>
  );
}
