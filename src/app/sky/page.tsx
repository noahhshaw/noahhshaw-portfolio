"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [panelOpen, setPanelOpen] = useState(false);

  const [day, setDay] = useState<string>(DEFAULT_DATE.toISOString().slice(0, 10));
  const [hour, setHour] = useState<number>(22);
  const [minute, setMinute] = useState<number>(0);
  const date = useMemo(() => {
    const d = new Date(`${day}T00:00:00`);
    d.setHours(hour, minute, 0, 0);
    return d;
  }, [day, hour, minute]);

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

  const [search, setSearch] = useState("");
  const [searchTarget, setSearchTarget] = useState<{ ra: number; dec: number; name: string } | null>(null);
  const [stars, setStars] = useState<Array<{ id: number; ra: number; dec: number }> | null>(null);
  const [starnames, setStarnames] = useState<Record<string, StarNameRec> | null>(null);

  const [selected, setSelected] = useState<{ name: string; detail: string } | null>(null);

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
    const params = new URLSearchParams(window.location.search);
    const qLat = params.get("lat");
    const qLon = params.get("lon");
    if (qLat && qLon) {
      setLoc({
        lat: parseFloat(qLat),
        lon: parseFloat(qLon),
        label: params.get("label") || `(${qLat}, ${qLon})`,
      });
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ layers, magLimit }));
  }, [layers, magLimit]);

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
        setErr(`${e.message}${location.protocol !== "https:" && location.hostname !== "localhost" ? " (geolocation requires HTTPS)" : ""}`);
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

  const runSearch = () => {
    if (!search.trim()) {
      setSearchTarget(null);
      return;
    }
    const q = search.trim().toLowerCase();
    if (PLANET_NAMES.some((p) => p.toLowerCase() === q)) {
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
  const totalMin = hour * 60 + minute;

  return (
    <main className="h-screen w-screen bg-black text-slate-100 flex flex-col overflow-hidden">
      {/* Thin top bar */}
      <header className="px-3 py-2 border-b border-slate-800 flex items-center gap-2 flex-shrink-0">
        <h1 className="text-sm font-semibold whitespace-nowrap mr-1 hidden sm:block">Night Sky</h1>
        <form onSubmit={lookup} className="flex gap-1 flex-1 min-w-0 items-center">
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Enter an address…"
            className="flex-1 min-w-0 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-sm"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 rounded text-sm whitespace-nowrap"
          >
            {loading ? "…" : "Go"}
          </button>
          <button
            type="button"
            onClick={geolocate}
            disabled={loading}
            title="Use my location"
            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-sm border border-slate-700"
          >
            📍
          </button>
        </form>
        {selected && (
          <div className="hidden md:flex items-center gap-2 text-xs bg-slate-900/70 border border-slate-700 rounded px-2 py-1 max-w-[280px]">
            <div className="min-w-0">
              <div className="font-semibold truncate">{selected.name}</div>
              <div className="text-slate-400 truncate">{selected.detail}</div>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="text-slate-400 hover:text-white"
              aria-label="dismiss"
            >
              ×
            </button>
          </div>
        )}
        <button
          onClick={() => setPanelOpen((o) => !o)}
          className={`px-3 py-1 rounded text-sm border whitespace-nowrap ${
            panelOpen ? "bg-indigo-600 border-indigo-500" : "bg-slate-800 border-slate-700 hover:bg-slate-700"
          }`}
          aria-expanded={panelOpen}
        >
          ⚙ Controls
        </button>
      </header>

      {err && (
        <div className="px-3 py-1 text-red-400 text-xs border-b border-red-900/40 bg-red-950/30 flex items-center justify-between">
          <span>{err}</span>
          <button onClick={() => setErr(null)} className="text-red-300 hover:text-white">×</button>
        </div>
      )}

      <div className="flex-1 relative min-h-0">
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
          <div className="flex flex-col items-center justify-center h-full text-slate-400 text-sm gap-2 px-4 text-center">
            <p>Enter an address above, or click 📍 to use your location.</p>
            <p className="text-slate-500 text-xs">
              Try: <button
                className="underline hover:text-slate-200"
                onClick={() => setAddress("Brooklyn, NY")}
              >Brooklyn, NY</button> · <button
                className="underline hover:text-slate-200"
                onClick={() => setAddress("Reykjavik, Iceland")}
              >Reykjavik, Iceland</button> · <button
                className="underline hover:text-slate-200"
                onClick={() => setAddress("Sydney, Australia")}
              >Sydney, Australia</button>
            </p>
          </div>
        )}

        {/* Mobile identify chip */}
        {selected && (
          <div className="md:hidden absolute top-3 right-3 max-w-[60%] text-xs bg-slate-900/90 border border-slate-700 rounded px-2 py-1 flex items-start gap-2">
            <div className="min-w-0">
              <div className="font-semibold truncate">{selected.name}</div>
              <div className="text-slate-400 truncate">{selected.detail}</div>
            </div>
            <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-white">×</button>
          </div>
        )}

        {/* Backdrop when panel open on mobile */}
        {panelOpen && (
          <div
            className="md:hidden absolute inset-0 bg-black/40 z-10"
            onClick={() => setPanelOpen(false)}
          />
        )}

        {/* Drawer */}
        <aside
          style={{ backgroundColor: "#020617" }}
          className={`absolute z-20 shadow-2xl border-slate-800 transition-transform duration-200 overflow-y-auto
            left-0 right-0 bottom-0 max-h-[70%] border-t rounded-t-xl
            md:left-auto md:right-0 md:top-0 md:bottom-0 md:max-h-none md:h-full md:w-80 md:border-t-0 md:border-l md:rounded-none
            ${panelOpen ? "translate-y-0 md:translate-y-0 md:translate-x-0" : "translate-y-full md:translate-y-0 md:translate-x-full"}`}
        >
          <div className="p-4 space-y-5 text-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Controls</h2>
              <button
                onClick={() => setPanelOpen(false)}
                className="text-slate-400 hover:text-white"
                aria-label="close"
              >
                ×
              </button>
            </div>

            {recent.length > 0 && (
              <section>
                <div className="text-xs uppercase tracking-wide text-slate-500 mb-1.5">Recent</div>
                <div className="flex flex-wrap gap-1">
                  {recent.map((r) => (
                    <button
                      key={r.label}
                      onClick={() => {
                        setLoc(r);
                        setAddress(r.label);
                      }}
                      className="px-2 py-0.5 bg-slate-900 border border-slate-700 rounded text-xs hover:bg-slate-800 truncate max-w-[220px]"
                      title={r.label}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </section>
            )}

            <section className="space-y-2">
              <div className="text-xs uppercase tracking-wide text-slate-500">Time</div>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs flex-1"
                />
                <button onClick={setNow} className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs">
                  Now
                </button>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Hour</span>
                  <span className="font-mono">
                    {String(hour).padStart(2, "0")}:{String(minute).padStart(2, "0")}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={23 * 60 + 59}
                  step={5}
                  value={totalMin}
                  onChange={(e) => {
                    const m = Number(e.target.value);
                    setHour(Math.floor(m / 60));
                    setMinute(m % 60);
                  }}
                  className="w-full"
                />
              </div>
            </section>

            <section className="space-y-2">
              <div className="text-xs uppercase tracking-wide text-slate-500">Display</div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Star magnitude limit</span>
                  <span className="font-mono">{magLimit.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min={2.5}
                  max={6}
                  step={0.1}
                  value={magLimit}
                  onChange={(e) => setMagLimit(Number(e.target.value))}
                  className="w-full"
                />
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Rotate</span>
                  <span className="font-mono">{rotation}°</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={359}
                  step={1}
                  value={rotation}
                  onChange={(e) => setRotation(Number(e.target.value))}
                  className="w-full"
                />
              </div>
              <button
                onClick={() => {
                  setResetSignal((n) => n + 1);
                  setRotation(0);
                }}
                className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs hover:bg-slate-700"
              >
                Reset view
              </button>
            </section>

            <section>
              <div className="text-xs uppercase tracking-wide text-slate-500 mb-1.5">Layers</div>
              <div className="grid grid-cols-2 gap-1.5">
                {([
                  ["lines", "Constellations"],
                  ["conLabels", "Names"],
                  ["starNames", "Star names"],
                  ["planets", "Planets"],
                  ["milkyway", "Milky Way"],
                  ["grid", "Alt/Az grid"],
                ] as Array<[keyof Layers, string]>).map(([k, lbl]) => (
                  <label key={k} className="flex items-center gap-2 text-xs px-2 py-1 bg-slate-900/50 border border-slate-800 rounded cursor-pointer hover:bg-slate-900">
                    <input
                      type="checkbox"
                      checked={layers[k]}
                      onChange={() => toggle(k)}
                      className="accent-indigo-500"
                    />
                    {lbl}
                  </label>
                ))}
              </div>
            </section>

            <section>
              <div className="text-xs uppercase tracking-wide text-slate-500 mb-1.5">Find</div>
              <div className="flex gap-1">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      runSearch();
                    }
                  }}
                  placeholder="Vega, Sirius, Polaris…"
                  className="flex-1 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs"
                />
                <button
                  type="button"
                  onClick={runSearch}
                  className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs hover:bg-slate-700"
                >
                  Find
                </button>
                {searchTarget && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setSearchTarget(null);
                    }}
                    className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs"
                  >
                    Clear
                  </button>
                )}
              </div>
            </section>

            <section className="text-[11px] text-slate-500 leading-relaxed border-t border-slate-800 pt-3">
              drag/pinch · scroll to zoom · arrows pan · +/- zoom · R reset · click an object · Esc to dismiss
            </section>
          </div>
        </aside>

        {loading && loc && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-sm text-slate-300 z-30">
            loading…
          </div>
        )}
      </div>
    </main>
  );
}
