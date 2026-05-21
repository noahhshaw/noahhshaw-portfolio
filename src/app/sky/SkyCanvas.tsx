"use client";

import { useEffect, useRef, useState } from "react";
import { eqToHoriz, bodiesAt, moonPhase, type Body } from "./astro";

type StarFeature = {
  id: number;
  properties: { mag: number; bv?: string };
  geometry: { type: "Point"; coordinates: [number, number] };
};
type ConLine = {
  id: string;
  geometry: { type: "MultiLineString"; coordinates: [number, number][][] };
};

type Props = {
  lat: number;
  lon: number;
  date: Date;
  label: string;
};

// Stereographic projection from zenith. (alt, az) -> (x, y) on unit disk where
// zenith is at origin and the horizon is the unit circle. North up, East right.
function project(altDeg: number, azDeg: number): [number, number] | null {
  if (altDeg < -2) return null;
  const z = (90 - altDeg) * (Math.PI / 180); // zenith distance
  const r = Math.tan(z / 2); // stereographic
  // az 0 = North, 90 = East. Screen y-up = North.
  const az = azDeg * (Math.PI / 180);
  const x = r * Math.sin(az);
  const y = -r * Math.cos(az); // north is up (negative screen y)
  return [x, y];
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

export default function SkyCanvas({ lat, lon, date, label }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [stars, setStars] = useState<StarFeature[] | null>(null);
  const [lines, setLines] = useState<ConLine[] | null>(null);
  const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 });
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number; text: string } | null>(null);

  useEffect(() => {
    fetch("/sky/stars.json")
      .then((r) => r.json())
      .then((d) => setStars(d.features));
    fetch("/sky/constellations.lines.json")
      .then((r) => r.json())
      .then((d) => setLines(d.features));
  }, []);

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

    // Background gradient
    const bg = ctx.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, Math.max(W, H) / 1.2);
    bg.addColorStop(0, "#04060f");
    bg.addColorStop(1, "#000003");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const baseR = Math.min(W, H) / 2 - 20;
    const cx = W / 2 + view.tx;
    const cy = H / 2 + view.ty;
    const R = baseR * view.scale;

    const toScreen = (p: [number, number]) => [cx + p[0] * R, cy + p[1] * R] as const;

    // Horizon circle + cardinal directions
    ctx.save();
    ctx.strokeStyle = "rgba(120,140,200,0.4)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();
    // Alt grid (30, 60)
    ctx.strokeStyle = "rgba(80,100,160,0.18)";
    [30, 60].forEach((alt) => {
      const z = (90 - alt) * (Math.PI / 180);
      const r = Math.tan(z / 2) * R;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    });
    // Az grid every 30°
    for (let a = 0; a < 360; a += 30) {
      const rad = a * (Math.PI / 180);
      const x2 = cx + R * Math.sin(rad);
      const y2 = cy - R * Math.cos(rad);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.restore();

    // Cardinal labels
    ctx.fillStyle = "#9fb0d8";
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
      const rad = a * (Math.PI / 180);
      const x2 = cx + (R + 12) * Math.sin(rad);
      const y2 = cy - (R + 12) * Math.cos(rad);
      ctx.fillText(t, x2, y2);
    });

    // Constellation lines
    ctx.strokeStyle = "rgba(100,160,230,0.45)";
    ctx.lineWidth = 1;
    lines.forEach((feat) => {
      feat.geometry.coordinates.forEach((segment) => {
        let prev: [number, number] | null = null;
        for (const [raDeg, decDeg] of segment) {
          const ra = ((raDeg % 360) + 360) % 360;
          const h = eqToHoriz({ raDeg: ra, decDeg }, lat, lon, date);
          const p = project(h.altDeg, h.azDeg);
          if (!p || h.altDeg < 0) {
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

    // Stars
    stars.forEach((s) => {
      const [raRaw, dec] = s.geometry.coordinates;
      const ra = ((raRaw % 360) + 360) % 360;
      const h = eqToHoriz({ raDeg: ra, decDeg: dec }, lat, lon, date);
      if (h.altDeg < 0) return;
      const p = project(h.altDeg, h.azDeg);
      if (!p) return;
      const [sx, sy] = toScreen(p);
      const mag = s.properties.mag;
      const size = Math.max(0.4, (6.5 - mag) * 0.55) * Math.sqrt(view.scale);
      ctx.fillStyle = bvToColor(s.properties.bv);
      ctx.globalAlpha = mag > 5 ? 0.6 : 1;
      ctx.beginPath();
      ctx.arc(sx, sy, size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Sun, Moon, planets
    const bodies: Body[] = bodiesAt(date, lat, lon);
    bodies.forEach((b) => {
      const h = eqToHoriz({ raDeg: b.ra, decDeg: b.dec }, lat, lon, date);
      if (h.altDeg < -2) return;
      const p = project(h.altDeg, h.azDeg);
      if (!p) return;
      const [sx, sy] = toScreen(p);
      if (b.kind === "sun") {
        ctx.fillStyle = "#ffd14a";
        ctx.beginPath();
        ctx.arc(sx, sy, 8 * Math.sqrt(view.scale), 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,209,74,0.25)";
        ctx.beginPath();
        ctx.arc(sx, sy, 18 * Math.sqrt(view.scale), 0, Math.PI * 2);
        ctx.fill();
      } else if (b.kind === "moon") {
        const phase = moonPhase(date);
        const r = 8 * Math.sqrt(view.scale);
        ctx.fillStyle = "#1a1d28";
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#e8ecf6";
        // Crude phase: cosine-weighted crescent.
        const illum = 1 - Math.cos(phase * 2 * Math.PI);
        ctx.beginPath();
        ctx.arc(sx, sy, r, -Math.PI / 2, Math.PI / 2);
        ctx.ellipse(sx, sy, r * Math.abs(1 - illum), r, 0, Math.PI / 2, -Math.PI / 2, illum < 1);
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
      ctx.fillStyle = "rgba(220,230,255,0.85)";
      ctx.font = "11px ui-sans-serif, system-ui";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(b.name, sx + 10, sy);
    });
  }, [stars, lines, lat, lon, date, view]);

  const onWheel: React.WheelEventHandler<HTMLCanvasElement> = (e) => {
    e.preventDefault();
    const factor = Math.exp(-e.deltaY * 0.001);
    setView((v) => {
      const newScale = Math.max(0.6, Math.min(8, v.scale * factor));
      const rect = canvasRef.current!.getBoundingClientRect();
      const mx = e.clientX - rect.left - rect.width / 2;
      const my = e.clientY - rect.top - rect.height / 2;
      // Zoom toward cursor.
      const k = newScale / v.scale;
      return {
        scale: newScale,
        tx: mx - (mx - v.tx) * k,
        ty: my - (my - v.ty) * k,
      };
    });
  };

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full block cursor-grab active:cursor-grabbing"
        onWheel={onWheel}
        onMouseDown={(e) => {
          drag.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty };
        }}
        onMouseMove={(e) => {
          if (!drag.current) return;
          setView((v) => ({
            ...v,
            tx: drag.current!.tx + (e.clientX - drag.current!.x),
            ty: drag.current!.ty + (e.clientY - drag.current!.y),
          }));
        }}
        onMouseUp={() => (drag.current = null)}
        onMouseLeave={() => (drag.current = null)}
      />
      <div className="absolute top-3 left-3 text-xs text-slate-300/80 bg-black/40 rounded px-2 py-1 max-w-[60%]">
        {label}
        <br />
        {date.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })} · lat {lat.toFixed(3)}, lon {lon.toFixed(3)}
      </div>
      <div className="absolute bottom-3 left-3 text-[11px] text-slate-400/70">
        scroll to zoom · drag to pan
      </div>
      {hover && (
        <div
          className="absolute pointer-events-none text-xs bg-black/70 text-white px-2 py-1 rounded"
          style={{ left: hover.x + 8, top: hover.y + 8 }}
        >
          {hover.text}
        </div>
      )}
    </div>
  );
}
