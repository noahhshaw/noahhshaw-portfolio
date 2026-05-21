"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import SkyCanvas, { type Layers } from "./SkyCanvas";

type Loc = { lat: number; lon: number; label: string };

const DEFAULT_DATE = new Date("2026-05-21T22:00:00");

const RECENT_KEY = "sky.recent";
const SETTINGS_KEY = "sky.settings";

const PLANET_NAMES = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"];

type StarNameRec = { name?: string; bayer?: string; c?: string };

export default function SkyPage() {
  const [address, setAddress] = useState("");
  const [loc, setLoc] = useState<Loc | null>(null);
  const [recent, setRecent] = useState<Loc[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Time controls
  const [day, setDay] = useState<string>(DEFAULT_DATE.toISOString().slice(0, 10));
  const [hour, setHour] = useState<number>(22);
  const [minute, setMinute] = useState<number>(0);
  const date = useMemo(() => {
    const d = new Date(`${day}T00:00:00`);
    d.setHours(hour, minute, 0, 0);
    return d;
  }, [day, hour, minute]);

  // Layer + view controls
  const [layers, setLayers] = useState<Layers>({
    lines: true,
    conLabels: true,
    starNames: true,
    planets: true,
    milkyway: true,
    grid: true,
  });
  const [magLimit, setMagLimit] = useState(5.5);
  const [rotation, setRotation] = useState(0);
  const [resetSignal, setResetSignal] = useState(0);

  // Search
  const [search, setSearch] = useState("");
  const [searchTarget, setSearchTarget] = useState<{ ra: number; dec: number; name: string } | null>(null);
  const [stars, setStars] = useState<Array<{ id: number; ra: number; dec: number }> | null>(null);
  const [starnames, setStarnames] = useState<Record<string, StarNameRec> | null>(null);

  // Selected object (from canvas click)
  const [selected, setSelected] = useState<{ name: string; detail: string } | null>(null);

  // Load saved settings + recent
  useEffect(() => {
    try {
      const r = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
      if (Array.isArray(r)) setRecent(r);
      const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
      if (s) {
        if (s.layers) setLayers(s.layers);
        if (typeof s.magLimit === "number") setMagLimit(s.magLimit);
      }
    } catch {}
  }, []);
  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ layers, magLimit }));
  }, [layers, magLimit]);

  // Load star catalog for search
  useEffect(() => {
    fetch("/sky/stars.json")
      .then((r) => r.json())
      .then((d) => {
        setStars(
          d.features.map((f: { id: number; geometry: { coordinates: [number, number] } }) => ({
            id: f.id,
            ra: ((f.geometry.coordinates[0] % 360) + 360) % 360,
            dec: f.geometry.coordinates[1],
          }))
        );
      });
    fetch("/sky/starnames.json").then((r) => r.json()).then((d) => setStarnames(d));
  }, []);

  const pushRecent = (l: Loc) => {
    setRecent((prev) => {
      const next = [l, ...prev.filter((x) => x.label !== l.label)].slice(0, 5);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      return next;
    });
  };

  const lookup = async (e: React.FormEvent) => {
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
      const l: Loc = { lat: d.lat, lon: d.lon, label: d.label };
      setLoc(l);
      pushRecent(l);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "lookup failed");
    } finally {
      setLoading(false);
    }
  };

  const geolocate = () => {
    if (!navigator.geolocation) {
      setErr("geolocation not supported");
      return;
    }
    setLoading(true);
    setErr(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const l: Loc = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          label: `Your location (${pos.coords.latitude.toFixed(3)}, ${pos.coords.longitude.toFixed(3)})`,
        };
        setLoc(l);
        pushRecent(l);
        setLoading(false);
      },
      (e) => {
        setErr(e.message);
        setLoading(false);
      }
    );
  };

  const setNow = () => {
    const n = new Date();
    setDay(n.toISOString().slice(0, 10));
    setHour(n.getHours());
    setMinute(n.getMinutes());
  };

  const doSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!search.trim()) {
      setSearchTarget(null);
      return;
    }
    const q = search.trim().toLowerCase();
    // Planets/Sun/Moon — let canvas resolve via name match by passing a sentinel?
    // We'll just resolve stars here; bodies require ephemeris. For simplicity, only search stars by proper name.
    if (PLANET_NAMES.some((p) => p.toLowerCase() === q)) {
      // Can't compute here without ephemeris on client; instead, just clear and rely on label already shown.
      setSearchTarget(null);
      setErr(`${q} is labeled on the chart — look near the ecliptic.`);
      return;
    }
    if (!stars || !starnames) return;
    let bestId: number | null = null;
    for (const [id, rec] of Object.entries(starnames)) {
      if (rec.name && rec.name.toLowerCase() === q) {
        bestId = Number(id);
        break;
      }
    }
    if (bestId == null) {
      for (const [id, rec] of Object.entries(starnames)) {
        if (rec.name && rec.name.toLowerCase().startsWith(q)) {
          bestId = Number(id);
          break;
        }
      }
    }
    if (bestId == null) {
      setErr(`no star named "${search}"`);
      return;
    }
    const s = stars.find((x) => x.id === bestId);
    if (!s) {
      setErr("found name but no position");
      return;
    }
    const rec = starnames[String(bestId)];
    setSearchTarget({ ra: s.ra, dec: s.dec, name: rec.name || search });
    setErr(null);
  };

  const toggle = (k: keyof Layers) => setLayers((l) => ({ ...l, [k]: !l[k] }));

  return (
    <main className="min-h-screen bg-black text-slate-100 flex flex-col">
      <header className="p-3 border-b border-slate-800 space-y-2">
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold">Night Sky</h1>
            <p className="text-xs text-slate-400">
              Enter an address — or use your location — to render the sky overhead.
            </p>
          </div>
          {selected && (
            <div className="text-xs bg-slate-900/70 border border-slate-700 rounded px-2 py-1">
              <div className="font-semibold">{selected.name}</div>
              <div className="text-slate-400">{selected.detail}</div>
            </div>
          )}
        </div>

        <form onSubmit={lookup} className="flex gap-2 flex-wrap">
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="1600 Pennsylvania Ave NW, Washington DC"
            className="flex-1 min-w-[240px] px-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 rounded text-sm"
          >
            {loading ? "…" : "Look up"}
          </button>
          <button
            type="button"
            onClick={geolocate}
            disabled={loading}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-sm border border-slate-700"
          >
            Use my location
          </button>
        </form>

        {recent.length > 0 && (
          <div className="flex gap-2 flex-wrap text-xs items-center">
            <span className="text-slate-500">Recent:</span>
            {recent.map((r) => (
              <button
                key={r.label}
                onClick={() => setLoc(r)}
                className="px-2 py-0.5 bg-slate-900 border border-slate-700 rounded hover:bg-slate-800 truncate max-w-[260px]"
              >
                {r.label.split(",")[0]}
              </button>
            ))}
          </div>
        )}

        {err && <p className="text-red-400 text-xs">{err}</p>}

        <div className="flex flex-wrap gap-3 items-center text-xs">
          <label className="flex items-center gap-1">
            <span className="text-slate-400">Date</span>
            <input
              type="date"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5"
            />
          </label>
          <label className="flex items-center gap-2">
            <span className="text-slate-400 w-10">Hour {String(hour).padStart(2, "0")}:{String(minute).padStart(2, "0")}</span>
            <input
              type="range"
              min={0}
              max={23 * 60 + 59}
              step={5}
              value={hour * 60 + minute}
              onChange={(e) => {
                const m = Number(e.target.value);
                setHour(Math.floor(m / 60));
                setMinute(m % 60);
              }}
              className="w-48"
            />
          </label>
          <button onClick={setNow} className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded">
            Now
          </button>

          <span className="mx-2 text-slate-700">|</span>

          <label className="flex items-center gap-2">
            <span className="text-slate-400">Mag ≤ {magLimit.toFixed(1)}</span>
            <input
              type="range"
              min={2.5}
              max={6}
              step={0.1}
              value={magLimit}
              onChange={(e) => setMagLimit(Number(e.target.value))}
              className="w-32"
            />
          </label>

          <label className="flex items-center gap-2">
            <span className="text-slate-400">Rotate {rotation}°</span>
            <input
              type="range"
              min={0}
              max={359}
              step={1}
              value={rotation}
              onChange={(e) => setRotation(Number(e.target.value))}
              className="w-32"
            />
          </label>

          <button
            onClick={() => {
              setResetSignal((n) => n + 1);
              setRotation(0);
            }}
            className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded"
          >
            Reset view
          </button>

          <span className="mx-2 text-slate-700">|</span>

          {([
            ["lines", "Lines"],
            ["conLabels", "Names"],
            ["starNames", "Star names"],
            ["planets", "Planets"],
            ["milkyway", "Milky Way"],
            ["grid", "Grid"],
          ] as Array<[keyof Layers, string]>).map(([k, label]) => (
            <label key={k} className="flex items-center gap-1 select-none">
              <input type="checkbox" checked={layers[k]} onChange={() => toggle(k)} />
              {label}
            </label>
          ))}

          <form onSubmit={doSearch} className="ml-auto flex gap-1">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find star (Vega, Sirius…)"
              className="px-2 py-0.5 bg-slate-900 border border-slate-700 rounded w-44"
            />
            <button className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded">Find</button>
            {searchTarget && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setSearchTarget(null);
                }}
                className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded"
              >
                Clear
              </button>
            )}
          </form>
        </div>
      </header>

      <div className="flex-1 relative">
        {loc ? (
          <SkyCanvas
            lat={loc.lat}
            lon={loc.lon}
            date={date}
            label={loc.label}
            layers={layers}
            magLimit={magLimit}
            rotationDeg={rotation}
            searchTarget={searchTarget}
            resetSignal={resetSignal}
            onIdentify={(i) => setSelected(i ? { name: i.name, detail: i.detail } : null)}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-slate-500 text-sm">
            Enter an address above (or click "Use my location") to render the night sky.
          </div>
        )}
        {loading && loc && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-sm text-slate-300">
            loading…
          </div>
        )}
      </div>
    </main>
  );
}
