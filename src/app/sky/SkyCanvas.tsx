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

function drawTextWithShadow(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string
) {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.85)";
  ctx.shadowBlur = 4;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

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
  const [tooltip, setTooltip] = useState<{ x: number; y: number; name: string; detail: string } | null>(null);
  const hitsRef = useRef<Hit[]>([]);
  const dataLoading = !stars || !lines;

  // Reset view
  useEffect(() => {
    setView({ scale: 1, tx: 0, ty: 0 });
  }, [resetSignal]);

  // Dismiss tooltip on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setTooltip(null);
        onIdentify?.(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onIdentify]);

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

    const sunAlt = (() => {
      const b = bodiesAt(date, lat, lon).find((x) => x.kind === "sun");
      if (!b) return -90;
      return eqToHoriz({ raDeg: b.ra, decDeg: b.dec }, lat, lon, date).altDeg;
    })();
    const day = Math.max(0, Math.min(1, (sunAlt + 6) / 12));

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

    // Clip to horizon disk
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.clip();

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
        // Hit registration: any visible star
        const nm = names?.[String(s.id)];
        const hitLabel =
          nm?.name ||
          (nm?.bayer ? `${nm.bayer} ${nm.c ?? ""}`.trim() : null) ||
          (nm?.desig ? `${nm.desig} ${nm.c ?? ""}`.trim() : null) ||
          `HIP ${s.id}`;
        hits.push({
          sx,
          sy,
          name: hitLabel,
          detail: `star · mag ${mag.toFixed(2)} · alt ${h.altDeg.toFixed(1)}° · az ${h.azDeg.toFixed(1)}°`,
        });
        if (layers.starNames && view.scale > 2.5 && mag < 2.8) {
          const proper = nm?.name;
          if (proper) {
            ctx.globalAlpha = Math.min(1, (view.scale - 2.5) / 1.5) * starAlpha;
            ctx.font = "11px ui-sans-serif, system-ui";
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            drawTextWithShadow(ctx, proper, sx + size + 3, sy, "rgba(220,230,255,0.95)");
          }
        }
      });
      ctx.globalAlpha = 1;
    }

    // Constellation names — fade in only above zoom 1.5
    if (layers.conLabels && centers && view.scale > 1.4) {
      const a = Math.min(1, (view.scale - 1.4) / 1.0) * 0.8 * (1 - day * 0.5);
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
        drawTextWithShadow(ctx, c.properties.name, sx, sy, `rgba(150,200,255,${a})`);
      });
    }

    // Sun, Moon, planets — collect screen positions first for label de-overlap
    const bodies: Body[] = bodiesAt(date, lat, lon);
    type Drawn = { b: Body; sx: number; sy: number; h: { altDeg: number; azDeg: number }; size: number };
    const drawn: Drawn[] = [];
    bodies.forEach((b) => {
      if (!layers.planets && b.kind === "planet") return;
      const h = eqToHoriz({ raDeg: b.ra, decDeg: b.dec }, lat, lon, date);
      if (h.altDeg < -2) return;
      const p = project(h.altDeg, h.azDeg, rotationDeg);
      if (!p) return;
      const [sx, sy] = toScreen(p);
      let size = 4;
      if (b.kind === "sun") size = 10 * Math.sqrt(view.scale);
      else if (b.kind === "moon") size = 10 * Math.sqrt(view.scale);
      else size = Math.max(3, (3 - b.magnitude) * 1.2) * Math.sqrt(view.scale);
      drawn.push({ b, sx, sy, h, size });
    });

    // Draw bodies (markers)
    drawn.forEach(({ b, sx, sy, size }) => {
      if (b.kind === "sun") {
        const r = size;
        ctx.fillStyle = "rgba(255,209,74,0.3)";
        ctx.beginPath();
        ctx.arc(sx, sy, r * 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffd14a";
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(40,30,0,0.6)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else if (b.kind === "moon") {
        const phase = moonPhase(date);
        const r = size;
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
        ctx.strokeStyle = "rgba(255,255,255,0.5)";
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
        ctx.beginPath();
        ctx.arc(sx, sy, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.5)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      const bh = eqToHoriz({ raDeg: b.ra, decDeg: b.dec }, lat, lon, date);
      hits.push({
        sx,
        sy,
        name: b.name,
        detail: `${b.kind} · mag ${b.magnitude.toFixed(2)} · alt ${bh.altDeg.toFixed(1)}° · az ${bh.azDeg.toFixed(1)}°`,
      });
    });

    // Label de-overlap: stack labels vertically when within 18px
    const labelGap = 18;
    const sorted = [...drawn].sort((a, b) => a.sy - b.sy || a.sx - b.sx);
    type LabelPos = { d: Drawn; lx: number; ly: number };
    const placed: LabelPos[] = [];
    sorted.forEach((d) => {
      const baseX = d.sx + d.size + 6;
      let ly = d.sy;
      // Push down past any close prior labels
      for (const p of placed) {
        if (Math.abs(p.lx - baseX) < 60 && Math.abs(p.ly - ly) < labelGap) {
          ly = p.ly + labelGap;
        }
      }
      placed.push({ d, lx: baseX, ly });
    });
    ctx.font = "bold 12px ui-sans-serif, system-ui";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    placed.forEach(({ d, lx, ly }) => {
      // Leader line if displaced
      if (Math.abs(ly - d.sy) > 2) {
        ctx.strokeStyle = "rgba(220,230,255,0.4)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(d.sx + d.size + 2, d.sy);
        ctx.lineTo(lx - 2, ly);
        ctx.stroke();
      }
      drawTextWithShadow(ctx, d.b.name, lx, ly, "rgba(240,245,255,0.95)");
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
          ctx.font = "bold 12px ui-sans-serif, system-ui";
          ctx.textAlign = "left";
          drawTextWithShadow(ctx, searchTarget.name, sx + 18, sy, "#ffeb6b");
        }
      }
    }

    ctx.restore(); // unclip

    // Horizon ring
    ctx.strokeStyle = `rgba(180,200,240,${0.55 + day * 0.25})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();

    if (layers.grid) {
      ctx.strokeStyle = "rgba(80,100,160,0.18)";
      [30, 60].forEach((alt) => {
        const z = (90 - alt) * DEG;
        const r = Math.tan(z / 2) * R;
        if (r < Math.max(W, H)) {
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.stroke();
        }
      });
      for (let a = 0; a < 360; a += 30) {
        const p1 = project(0, a, rotationDeg)!;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + p1[0] * R, cy + p1[1] * R);
        ctx.stroke();
      }
    }

    // Cardinals on horizon
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
      const x = cx + p[0] * R * ext;
      const y = cy + p[1] * R * ext;
      // Only draw on-screen
      if (x > -20 && x < W + 20 && y > -20 && y < H + 20) {
        drawTextWithShadow(ctx, t, x, y, "#ffffff");
      }
    });

    // Edge chevrons: when cardinals are off-screen due to zoom/pan,
    // draw a chevron at the canvas edge pointing toward that cardinal.
    cards.forEach(([t, a]) => {
      const p = project(0, a, rotationDeg)!;
      const x = cx + p[0] * R;
      const y = cy + p[1] * R;
      const onScreen = x > 0 && x < W && y > 0 && y < H;
      if (onScreen) return;
      // Find intersection of line from (W/2,H/2) toward (x,y) with edge inset by 14
      const inset = 22;
      const dx = x - W / 2;
      const dy = y - H / 2;
      const sx = (W / 2 - inset) / Math.max(Math.abs(dx), 1);
      const sy = (H / 2 - inset) / Math.max(Math.abs(dy), 1);
      const s = Math.min(sx, sy);
      const ex = W / 2 + dx * s;
      const ey = H / 2 + dy * s;
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(Math.atan2(dy, dx));
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.beginPath();
      ctx.roundRect(-22, -12, 44, 24, 6);
      ctx.fill();
      ctx.rotate(-Math.atan2(dy, dx));
      ctx.font = "bold 12px ui-sans-serif, system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      drawTextWithShadow(ctx, t, 0, 0, "#ffffff");
      // arrow tip
      ctx.rotate(Math.atan2(dy, dx));
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(13, -4);
      ctx.lineTo(13, 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });

    // Minimap when zoomed in
    if (view.scale > 1.3) {
      const mmR = 54;
      const mmCx = W - mmR - 14;
      const mmCy = H - mmR - 14;
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.beginPath();
      ctx.arc(mmCx, mmCy, mmR + 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(180,200,240,0.6)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(mmCx, mmCy, mmR, 0, Math.PI * 2);
      ctx.stroke();
      // viewport indicator: scaled inverse of zoom
      // Visible canvas in projection units is (W/2 / R, H/2 / R); center offset is (-view.tx/R, -view.ty/R).
      const vw = (W / 2) / R;
      const vh = (H / 2) / R;
      const vcx = -view.tx / R;
      const vcy = -view.ty / R;
      ctx.strokeStyle = "#ffeb6b";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.rect(
        mmCx + (vcx - vw) * mmR,
        mmCy + (vcy - vh) * mmR,
        2 * vw * mmR,
        2 * vh * mmR
      );
      ctx.stroke();
      // N indicator
      ctx.font = "bold 10px ui-sans-serif, system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const np = project(0, 0, rotationDeg)!;
      drawTextWithShadow(ctx, "N", mmCx + np[0] * mmR, mmCy + np[1] * mmR, "#ffffff");
      ctx.restore();
    }

    hitsRef.current = hits;
  }, [stars, lines, centers, names, mw, lat, lon, date, view, layers, magLimit, rotationDeg, searchTarget]);

  // Pointer / drag / pinch
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{ dist: number; scale: number } | null>(null);
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
      // Snapshot the drag origin: the setView updater below runs asynchronously,
      // and onPointerUp may null out dragRef.current before React flushes it.
      // Reading dragRef.current!.tx inside the updater therefore crashed with
      // "Cannot read properties of null (reading 'tx')".
      const drag = dragRef.current;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (Math.hypot(dx, dy) > 3) movedRef.current = true;
      setView((v) => ({ ...v, tx: drag.tx + dx, ty: drag.ty + dy }));
    }
  };
  const onPointerUp: React.PointerEventHandler<HTMLCanvasElement> = (e) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchRef.current = null;
    if (pointers.current.size === 0) {
      if (!movedRef.current) {
        const rect = canvasRef.current!.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        let best: Hit | null = null;
        let bestD = 22;
        for (const h of hitsRef.current) {
          const d = Math.hypot(h.sx - x, h.sy - y);
          if (d < bestD) {
            bestD = d;
            best = h;
          }
        }
        if (best) {
          setTooltip({ x: best.sx, y: best.sy, name: best.name, detail: best.detail });
          onIdentify?.({ name: best.name, detail: best.detail, x: best.sx, y: best.sy });
        } else {
          setTooltip(null);
          onIdentify?.(null);
        }
      }
      dragRef.current = null;
    }
  };

  const onWheel = useCallback((e: WheelEvent) => {
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
  }, []);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.addEventListener("wheel", onWheel, { passive: false });
    return () => c.removeEventListener("wheel", onWheel);
  }, [onWheel]);

  // Keyboard pan / zoom / reset
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const step = 40;
      if (e.key === "ArrowLeft") setView((v) => ({ ...v, tx: v.tx + step }));
      else if (e.key === "ArrowRight") setView((v) => ({ ...v, tx: v.tx - step }));
      else if (e.key === "ArrowUp") setView((v) => ({ ...v, ty: v.ty + step }));
      else if (e.key === "ArrowDown") setView((v) => ({ ...v, ty: v.ty - step }));
      else if (e.key === "+" || e.key === "=") setView((v) => ({ ...v, scale: Math.min(10, v.scale * 1.2) }));
      else if (e.key === "-" || e.key === "_") setView((v) => ({ ...v, scale: Math.max(0.6, v.scale / 1.2) }));
      else if (e.key === "r" || e.key === "R") setView({ scale: 1, tx: 0, ty: 0 });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Pulse animation for search ring via rAF (no full setState churn)
  useEffect(() => {
    if (!searchTarget) return;
    let raf = 0;
    const tick = () => {
      setView((v) => ({ ...v }));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
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
      <div className="absolute top-3 left-3 text-xs text-slate-200 bg-black/70 rounded px-2 py-1 max-w-[60%] pointer-events-none">
        <div className="truncate">{label}</div>
        <div>
          {date.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })} · {lat.toFixed(3)}, {lon.toFixed(3)}
        </div>
      </div>
      {dataLoading && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm pointer-events-none">
          loading sky data…
        </div>
      )}
      {tooltip && (
        <div
          className="absolute bg-slate-900/95 border border-slate-700 text-white rounded shadow-lg px-3 py-2 pointer-events-auto"
          style={{
            left: Math.min(tooltip.x + 14, (canvasRef.current?.clientWidth ?? 9999) - 220),
            top: Math.min(tooltip.y + 14, (canvasRef.current?.clientHeight ?? 9999) - 70),
          }}
        >
          <div className="flex items-start gap-2">
            <div>
              <div className="text-sm font-semibold leading-tight">{tooltip.name}</div>
              <div className="text-[11px] text-slate-300 leading-tight">{tooltip.detail}</div>
            </div>
            <button
              onClick={() => {
                setTooltip(null);
                onIdentify?.(null);
              }}
              className="ml-1 text-slate-400 hover:text-white text-sm leading-none"
              aria-label="dismiss"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
