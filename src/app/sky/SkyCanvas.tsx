"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { eqToHoriz, bodiesAt, moonPhase, type Body } from "./astro";

type StarFeature = {
  id: number;
  properties: { mag: number; bv?: string };
  geometry: { type: "Point"; coordinates: [number, number] };
};
type ConLine = {
  id: string;
  properties: { rank: string };
  geometry: { type: "MultiLineString"; coordinates: [number, number][][] };
};
type ConCenter = {
  id: string;
  properties: { name: string; rank: string };
  geometry: { type: "Point"; coordinates: [number, number] };
};
type StarName = {
  name?: string;
  bayer?: string;
  c?: string;
  desig?: string;
};
type MwFeature = {
  geometry: {
    type: "MultiPolygon";
    coordinates: [number, number][][][];
  };
};

export type Layers = {
  lines: boolean;
  conLabels: boolean;
  starNames: boolean;
  planets: boolean;
  milkyway: boolean;
  grid: boolean;
};

type Props = {
  lat: number;
  lon: number;
  date: Date;
  label: string;
  layers: Layers;
  magLimit: number;
  rotationDeg: number;
  searchTarget: { ra: number; dec: number; name: string } | null;
  resetSignal: number;
  onIdentify?: (info: { name: string; detail: string; x: number; y: number } | null) => void;
};

const DEG = Math.PI / 180;

function project(altDeg: number, azDeg: number, rotationDeg: number): [number, number] | null {
  if (altDeg < -2) return null;
  const z = (90 - altDeg) * DEG;
  const r = Math.tan(z / 2);
  const az = (azDeg - rotationDeg) * DEG;
  return [r * Math.sin(az), -r * Math.cos(az)];
}

function bvToColor(bv?: string): string {
  if (!bv) return "#cfd8ff";
  const v = parseFloat(bv);
  if (isNaN(v)) return "#cfd8ff";
  if (v < -0.1) return "#a4c8ff";
  if (v < 0.3) return "#cfd8ff";
  if (v < 0.6) return "#fff8e8";
  if (v < 1.0) return "#ffe0a8";
  if (v < 1.5) return "#ffba78";
  return "#ff9966";
}

type Hit = {
  sx: number;
  sy: number;
  name: string;
  detail: string;
};

export default function SkyCanvas(props: Props) {
  const { lat, lon, date, label, layers, magLimit, rotationDeg, searchTarget, resetSignal, onIdentify } = props;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [stars, setStars] = useState<StarFeature[] | null>(null);
  const [lines, setLines] = useState<ConLine[] | null>(null);
  const [centers, setCenters] = useState<ConCenter[] | null>(null);
  const [names, setNames] = useState<Record<string, StarName> | null>(null);
  const [mw, setMw] = useState<MwFeature[] | null>(null);
  const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 });
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
  const hitsRef = useRef<Hit[]>([]);

  // Reset view
  useEffect(() => {
    setView({ scale: 1, tx: 0, ty: 0 });
  }, [resetSignal]);

  // Load data
  useEffect(() => {
    fetch("/sky/stars.json").then((r) => r.json()).then((d) => setStars(d.features));
    fetch("/sky/constellations.lines.json").then((r) => r.json()).then((d) => setLines(d.features));
    fetch("/sky/constellations.json").then((r) => r.json()).then((d) => setCenters(d.features));
    fetch("/sky/starnames.json").then((r) => r.json()).then((d) => setNames(d));
  }, []);

  useEffect(() => {
    if (!layers.milkyway || mw) return;
    fetch("/sky/mw.json").then((r) => r.json()).then((d) => setMw(d.features));
  }, [layers.milkyway, mw]);

  // Drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !stars || !lines) return;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const hits: Hit[] = [];

    // Sun altitude to decide daytime tinting
    const sunAlt = (() => {
      const b = bodiesAt(date, lat, lon).find((x) => x.kind === "sun");
      if (!b) return -90;
      return eqToHoriz({ raDeg: b.ra, decDeg: b.dec }, lat, lon, date).altDeg;
    })();
    const day = Math.max(0, Math.min(1, (sunAlt + 6) / 12)); // 0 night, 1 daylight

    // Background
    const bg = ctx.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, Math.max(W, H) / 1.2);
    if (day > 0) {
      bg.addColorStop(0, `rgba(${80 + 100 * day | 0}, ${130 + 90 * day | 0}, ${190 + 50 * day | 0}, 1)`);
      bg.addColorStop(1, `rgba(${20 + 40 * day | 0}, ${40 + 70 * day | 0}, ${90 + 90 * day | 0}, 1)`);
    } else {
      bg.addColorStop(0, "#04060f");
      bg.addColorStop(1, "#000003");
    }
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const baseR = Math.min(W, H) / 2 - 20;
    const cx = W / 2 + view.tx;
    const cy = H / 2 + view.ty;
    const R = baseR * view.scale;

    const toScreen = (p: [number, number]) => [cx + p[0] * R, cy + p[1] * R] as const;

    // Clip to horizon disk for sky content
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.clip();

    // Star alpha fades during daylight
    const starAlpha = 1 - day;

    // Milky way
    if (layers.milkyway && mw && starAlpha > 0) {
      ctx.fillStyle = `rgba(170,190,230,${0.04 * starAlpha})`;
      mw.forEach((feat) => {
        feat.geometry.coordinates.forEach((poly) => {
          poly.forEach((ring) => {
            ctx.beginPath();
            let started = false;
            for (const [raDeg, decDeg] of ring) {
              const ra = ((raDeg % 360) + 360) % 360;
              const h = eqToHoriz({ raDeg: ra, decDeg }, lat, lon, date);
              if (h.altDeg < -5) {
                started = false;
                continue;
              }
              const p = project(h.altDeg, h.azDeg, rotationDeg);
              if (!p) continue;
              const [sx, sy] = toScreen(p);
              if (!started) {
                ctx.moveTo(sx, sy);
                started = true;
              } else ctx.lineTo(sx, sy);
            }
            ctx.closePath();
            ctx.fill();
          });
        });
      });
    }

    // Constellation lines
    if (layers.lines) {
      ctx.strokeStyle = `rgba(100,160,230,${0.45 * (1 - day * 0.7)})`;
      ctx.lineWidth = 1;
      lines.forEach((feat) => {
        feat.geometry.coordinates.forEach((segment) => {
          let prev: [number, number] | null = null;
          for (const [raDeg, decDeg] of segment) {
            const ra = ((raDeg % 360) + 360) % 360;
            const h = eqToHoriz({ raDeg: ra, decDeg }, lat, lon, date);
            if (h.altDeg < 0) {
              prev = null;
              continue;
            }
            const p = project(h.altDeg, h.azDeg, rotationDeg);
            if (!p) {
              prev = null;
              continue;
            }
            const [sx, sy] = toScreen(p);
            if (prev) {
              ctx.beginPath();
              ctx.moveTo(prev[0], prev[1]);
              ctx.lineTo(sx, sy);
              ctx.stroke();
            }
            prev = [sx, sy];
          }
        });
      });
    }

    // Stars
    if (starAlpha > 0) {
      stars.forEach((s) => {
        const mag = s.properties.mag;
        if (mag > magLimit) return;
        const [raRaw, dec] = s.geometry.coordinates;
        const ra = ((raRaw % 360) + 360) % 360;
        const h = eqToHoriz({ raDeg: ra, decDeg: dec }, lat, lon, date);
        if (h.altDeg < 0) return;
        const p = project(h.altDeg, h.azDeg, rotationDeg);
        if (!p) return;
        const [sx, sy] = toScreen(p);
        const size = Math.max(0.4, (6.5 - mag) * 0.55) * Math.sqrt(view.scale);
        ctx.fillStyle = bvToColor(s.properties.bv);
        ctx.globalAlpha = (mag > 5 ? 0.6 : 1) * starAlpha;
        ctx.beginPath();
        ctx.arc(sx, sy, size, 0, Math.PI * 2);
        ctx.fill();
        // Record hits for bright stars only
        if (mag < 4) {
          const nm = names?.[String(s.id)];
          const label = nm?.name || (nm?.bayer ? `${nm.bayer} ${nm.c ?? ""}`.trim() : null);
          if (label) {
            hits.push({
              sx,
              sy,
              name: label,
              detail: `mag ${mag.toFixed(2)} · alt ${h.altDeg.toFixed(1)}° · az ${h.azDeg.toFixed(1)}°`,
            });
          }
        }
        // Bright star labels at high zoom
        if (layers.starNames && view.scale > 2.5 && mag < 2.8) {
          const nm = names?.[String(s.id)];
          if (nm?.name) {
            ctx.globalAlpha = Math.min(1, (view.scale - 2.5) / 1.5) * starAlpha;
            ctx.fillStyle = "rgba(220,230,255,0.9)";
            ctx.font = "11px ui-sans-serif, system-ui";
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.fillText(nm.name, sx + size + 3, sy);
          }
        }
      });
      ctx.globalAlpha = 1;
    }

    // Constellation names (centroid labels, fade with zoom)
    if (layers.conLabels && centers) {
      const a = Math.min(1, view.scale / 1.5) * 0.8 * (1 - day * 0.5);
      ctx.fillStyle = `rgba(150,200,255,${a})`;
      ctx.font = `italic ${11 + Math.min(4, view.scale)}px ui-sans-serif, system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      centers.forEach((c) => {
        const [raRaw, dec] = c.geometry.coordinates;
        const ra = ((raRaw % 360) + 360) % 360;
        const h = eqToHoriz({ raDeg: ra, decDeg: dec }, lat, lon, date);
        if (h.altDeg < 5) return;
        const p = project(h.altDeg, h.azDeg, rotationDeg);
        if (!p) return;
        const [sx, sy] = toScreen(p);
        ctx.fillText(c.properties.name, sx, sy);
      });
    }

    // Sun, Moon, planets
    const bodies: Body[] = bodiesAt(date, lat, lon);
    bodies.forEach((b) => {
      if (!layers.planets && b.kind === "planet") return;
      const h = eqToHoriz({ raDeg: b.ra, decDeg: b.dec }, lat, lon, date);
      if (h.altDeg < -2) return;
      const p = project(h.altDeg, h.azDeg, rotationDeg);
      if (!p) return;
      const [sx, sy] = toScreen(p);
      if (b.kind === "sun") {
        ctx.fillStyle = "rgba(255,209,74,0.3)";
        ctx.beginPath();
        ctx.arc(sx, sy, 18 * Math.sqrt(view.scale), 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffd14a";
        ctx.beginPath();
        ctx.arc(sx, sy, 8 * Math.sqrt(view.scale), 0, Math.PI * 2);
        ctx.fill();
      } else if (b.kind === "moon") {
        const phase = moonPhase(date);
        const r = 9 * Math.sqrt(view.scale);
        ctx.fillStyle = "#1a1d28";
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#e8ecf6";
        const illum = 0.5 - 0.5 * Math.cos(phase * 2 * Math.PI);
        ctx.beginPath();
        ctx.arc(sx, sy, r, -Math.PI / 2, Math.PI / 2);
        ctx.ellipse(sx, sy, r * Math.abs(1 - 2 * illum), r, 0, Math.PI / 2, -Math.PI / 2, illum > 0.5);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.4)";
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        const colors: Record<string, string> = {
          Mercury: "#bfc3c8",
          Venus: "#fff4c2",
          Mars: "#ff7a4a",
          Jupiter: "#ffd9a8",
          Saturn: "#f0e2b0",
          Uranus: "#a8e6f0",
          Neptune: "#7fa8ff",
        };
        ctx.fillStyle = colors[b.name] || "#ffffff";
        const r = Math.max(2.5, (3 - b.magnitude) * 1.0) * Math.sqrt(view.scale);
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "rgba(220,230,255,0.9)";
      ctx.font = "11px ui-sans-serif, system-ui";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(b.name, sx + 11, sy);
      hits.push({
        sx,
        sy,
        name: b.name,
        detail: `${b.kind} · mag ${b.magnitude.toFixed(2)} · alt ${h.altDeg.toFixed(1)}° · az ${h.azDeg.toFixed(1)}°`,
      });
    });

    // Search target highlight
    if (searchTarget) {
      const h = eqToHoriz({ raDeg: searchTarget.ra, decDeg: searchTarget.dec }, lat, lon, date);
      if (h.altDeg >= 0) {
        const p = project(h.altDeg, h.azDeg, rotationDeg);
        if (p) {
          const [sx, sy] = toScreen(p);
          ctx.strokeStyle = "#ffeb6b";
          ctx.lineWidth = 2;
          const t = (Date.now() / 400) % (Math.PI * 2);
          ctx.beginPath();
          ctx.arc(sx, sy, 14 + Math.sin(t) * 3, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = "#ffeb6b";
          ctx.font = "bold 12px ui-sans-serif, system-ui";
          ctx.textAlign = "left";
          ctx.fillText(searchTarget.name, sx + 18, sy);
        }
      }
    }

    ctx.restore(); // unclip

    // Horizon ring + grid (drawn on top of clip so they're crisp)
    ctx.strokeStyle = `rgba(120,140,200,${0.4 + day * 0.2})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();

    if (layers.grid) {
      ctx.strokeStyle = "rgba(80,100,160,0.18)";
      [30, 60].forEach((alt) => {
        const z = (90 - alt) * DEG;
        const r = Math.tan(z / 2) * R;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      });
      for (let a = 0; a < 360; a += 30) {
        const p1 = project(0, a, rotationDeg)!;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + p1[0] * R, cy + p1[1] * R);
        ctx.stroke();
      }
    }

    // Cardinals (always visible, rotated with compass)
    ctx.fillStyle = day > 0.3 ? "#1a2a4a" : "#9fb0d8";
    ctx.font = "bold 14px ui-sans-serif, system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const cards: Array<[string, number]> = [
      ["N", 0],
      ["E", 90],
      ["S", 180],
      ["W", 270],
    ];
    cards.forEach(([t, a]) => {
      const p = project(0, a, rotationDeg)!;
      const len = Math.hypot(p[0], p[1]) || 1;
      const ext = (R + 14) / (R * len);
      ctx.fillText(t, cx + p[0] * R * ext, cy + p[1] * R * ext);
    });

    hitsRef.current = hits;
  }, [stars, lines, centers, names, mw, lat, lon, date, view, layers, magLimit, rotationDeg, searchTarget]);

  // Pointer-based pan + pinch zoom
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{ dist: number; scale: number; cx: number; cy: number } | null>(null);
  const dragRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const movedRef = useRef(false);

  const onPointerDown: React.PointerEventHandler<HTMLCanvasElement> = (e) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    movedRef.current = false;
    if (pointers.current.size === 1) {
      dragRef.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty };
    } else if (pointers.current.size === 2) {
      const pts = Array.from(pointers.current.values());
      pinchRef.current = {
        dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
        scale: view.scale,
        cx: (pts[0].x + pts[1].x) / 2,
        cy: (pts[0].y + pts[1].y) / 2,
      };
      dragRef.current = null;
    }
  };
  const onPointerMove: React.PointerEventHandler<HTMLCanvasElement> = (e) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinchRef.current) {
      const pts = Array.from(pointers.current.values());
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const k = d / pinchRef.current.dist;
      const newScale = Math.max(0.6, Math.min(10, pinchRef.current.scale * k));
      setView((v) => ({ ...v, scale: newScale }));
      movedRef.current = true;
    } else if (dragRef.current) {
      const dx = e.clientX - dragRef.current.x;
      const dy = e.clientY - dragRef.current.y;
      if (Math.hypot(dx, dy) > 3) movedRef.current = true;
      setView((v) => ({ ...v, tx: dragRef.current!.tx + dx, ty: dragRef.current!.ty + dy }));
    }
  };
  const onPointerUp: React.PointerEventHandler<HTMLCanvasElement> = (e) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchRef.current = null;
    if (pointers.current.size === 0) {
      if (!movedRef.current) {
        // Click - identify nearest
        const rect = canvasRef.current!.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        let best: Hit | null = null;
        let bestD = 18;
        for (const h of hitsRef.current) {
          const d = Math.hypot(h.sx - x, h.sy - y);
          if (d < bestD) {
            bestD = d;
            best = h;
          }
        }
        if (best) {
          setTooltip({ x: best.sx, y: best.sy, text: `${best.name}\n${best.detail}` });
          onIdentify?.({ name: best.name, detail: best.detail, x: best.sx, y: best.sy });
        } else {
          setTooltip(null);
          onIdentify?.(null);
        }
      }
      dragRef.current = null;
    }
  };

  const onWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * 0.001);
      const rect = canvasRef.current!.getBoundingClientRect();
      const mx = e.clientX - rect.left - rect.width / 2;
      const my = e.clientY - rect.top - rect.height / 2;
      setView((v) => {
        const newScale = Math.max(0.6, Math.min(10, v.scale * factor));
        const k = newScale / v.scale;
        return { scale: newScale, tx: mx - (mx - v.tx) * k, ty: my - (my - v.ty) * k };
      });
    },
    []
  );

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.addEventListener("wheel", onWheel, { passive: false });
    return () => c.removeEventListener("wheel", onWheel);
  }, [onWheel]);

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const step = 40;
      if (e.key === "ArrowLeft") setView((v) => ({ ...v, tx: v.tx + step }));
      else if (e.key === "ArrowRight") setView((v) => ({ ...v, tx: v.tx - step }));
      else if (e.key === "ArrowUp") setView((v) => ({ ...v, ty: v.ty + step }));
      else if (e.key === "ArrowDown") setView((v) => ({ ...v, ty: v.ty - step }));
      else if (e.key === "+" || e.key === "=")
        setView((v) => ({ ...v, scale: Math.min(10, v.scale * 1.2) }));
      else if (e.key === "-" || e.key === "_")
        setView((v) => ({ ...v, scale: Math.max(0.6, v.scale / 1.2) }));
      else if (e.key === "r" || e.key === "R") setView({ scale: 1, tx: 0, ty: 0 });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Redraw animation for search pulse
  useEffect(() => {
    if (!searchTarget) return;
    const id = setInterval(() => setView((v) => ({ ...v })), 100);
    return () => clearInterval(id);
  }, [searchTarget]);

  return (
    <div ref={wrapRef} className="relative w-full h-full touch-none select-none">
      <canvas
        ref={canvasRef}
        className="w-full h-full block cursor-grab active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
      <div className="absolute top-3 left-3 text-xs text-slate-300/80 bg-black/40 rounded px-2 py-1 max-w-[60%] pointer-events-none">
        <div className="truncate">{label}</div>
        <div>
          {date.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })} · lat {lat.toFixed(3)}, lon {lon.toFixed(3)}
        </div>
      </div>
      <div className="absolute bottom-3 left-3 text-[11px] text-slate-400/70 pointer-events-none">
        drag/pinch · scroll to zoom · arrows pan · +/- zoom · R reset · click an object
      </div>
      {tooltip && (
        <div
          className="absolute text-xs bg-black/80 text-white px-2 py-1 rounded whitespace-pre leading-tight"
          style={{ left: tooltip.x + 10, top: tooltip.y + 10 }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}
