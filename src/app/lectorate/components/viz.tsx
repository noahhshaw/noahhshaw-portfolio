'use client'

/* Presentational SVG pieces for the Lectorate page — ports of the vanilla
   visualizations in the lectorate repo's web/app.js. Pure components: all
   data arrives via props. */

import type { CurvePoint, PiaacRow } from '../lib/lectorate-core'

export const COLORS = { us: '#e8b16b', world: '#6db8d8', speakers: '#b08fd8' }

export function pct(x: number | null | undefined, digits = 0): string {
  if (x == null) return '—'
  const v = x * 100
  if (v >= 99.95) return '100%'
  return v.toFixed(v < 1 && v > 0 ? 1 : digits) + '%'
}

export function gradeColor(g: number): string {
  const stops: [number, [number, number, number]][] = [
    [3, [127, 191, 127]],
    [8, [232, 177, 107]],
    [13, [216, 122, 109]],
    [18, [176, 143, 216]],
  ]
  let lo = stops[0]
  let hi = stops[stops.length - 1]
  for (let i = 0; i < stops.length - 1; i++) {
    if (g >= stops[i][0] && g <= stops[i + 1][0]) {
      lo = stops[i]
      hi = stops[i + 1]
      break
    }
  }
  const t = Math.min(1, Math.max(0, (g - lo[0]) / (hi[0] - lo[0] || 1)))
  const c = lo[1].map((v, i) => Math.round(v + t * (hi[1][i] - v)))
  return `rgb(${c[0]},${c[1]},${c[2]})`
}

export function gradeLabel(g: number): string {
  if (g < 1) return 'pre-school'
  if (g <= 5) return `~grade ${Math.round(g)} · elementary`
  if (g <= 8) return `~grade ${Math.round(g)} · middle school`
  if (g <= 12) return `~grade ${Math.round(g)} · high school`
  if (g <= 16) return `college level (year ${Math.round(g - 12)})`
  return 'postgraduate'
}

export function Donut({
  share,
  hi,
  color,
  size = 132,
}: {
  share: number
  hi?: number
  color: string
  size?: number
}) {
  const r = 52
  const cx = size / 2
  const cy = size / 2
  const C = 2 * Math.PI * r
  const main = Math.max(0.001, Math.min(1, share))
  const band = Math.min(1, hi ?? main)
  const rot = `rotate(-90 ${cx} ${cy})`
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={pct(share, 1)}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="11" />
      <circle
        cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeOpacity="0.25"
        strokeWidth="11" strokeDasharray={`${band * C} ${C}`} strokeLinecap="round" transform={rot}
      />
      <circle
        cx={cx} cy={cy} r={r} fill="none" stroke={color}
        strokeWidth="11" strokeDasharray={`${main * C} ${C}`} strokeLinecap="round" transform={rot}
      />
      <text
        x={cx} y={cy + 7} textAnchor="middle" fontSize="25" fontWeight="700"
        fill="#e8e6e1" style={{ fontFamily: 'Georgia, serif' }}
      >
        {pct(share, 1)}
      </text>
    </svg>
  )
}

export function GradeScale({
  g, lo90, hi90, lo50, hi50,
}: {
  g: number; lo90: number; hi90: number; lo50: number; hi50: number
}) {
  const W = 320
  const H = 56
  const x = (v: number) => 10 + (Math.min(18, Math.max(0, v)) / 18) * (W - 20)
  const ticks = []
  for (let i = 0; i <= 18; i += 3) {
    ticks.push(
      <g key={i}>
        <line x1={x(i)} y1={30} x2={x(i)} y2={36} stroke="rgba(255,255,255,0.25)" />
        <text x={x(i)} y={50} textAnchor="middle" fontSize="9" fill="#9a988f" style={{ fontFamily: 'monospace' }}>
          {i}
        </text>
      </g>
    )
  }
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`grade ${g.toFixed(1)}, 90% interval ${lo90.toFixed(1)} to ${hi90.toFixed(1)}`}>
      <defs>
        <linearGradient id="lec-gscale" x1="0" x2="1">
          <stop offset="0%" stopColor={gradeColor(0)} />
          <stop offset="28%" stopColor={gradeColor(5)} />
          <stop offset="55%" stopColor={gradeColor(10)} />
          <stop offset="78%" stopColor={gradeColor(14)} />
          <stop offset="100%" stopColor={gradeColor(18)} />
        </linearGradient>
      </defs>
      <rect x={10} y={26} width={W - 20} height={6} rx={3} fill="url(#lec-gscale)" opacity={0.5} />
      <line x1={x(lo90)} y1={29} x2={x(hi90)} y2={29} stroke="#e8e6e1" strokeWidth={1.4} opacity={0.55} />
      <rect x={x(lo50)} y={22} width={Math.max(2, x(hi50) - x(lo50))} height={14} rx={3} fill="#e8e6e1" opacity={0.22} />
      <circle cx={x(g)} cy={29} r={6} fill={gradeColor(g)} stroke="#0b0d11" strokeWidth={2} />
      {ticks}
    </svg>
  )
}

export function CurveChart({
  curve, grade, lo90, hi90, usNow, worldNow,
}: {
  curve: CurvePoint[]; grade: number; lo90: number; hi90: number
  usNow?: number; worldNow?: number | null
}) {
  const W = 620
  const H = 280
  const padL = 44; const padR = 14; const padT = 12; const padB = 30
  const x = (g: number) => padL + (g / 18) * (W - padL - padR)
  const y = (s: number) => padT + (1 - s) * (H - padT - padB)
  const line = (key: 'us' | 'world') =>
    curve
      .filter((p) => p[key] != null)
      .map((p) => `${x(p.grade).toFixed(1)},${y(p[key] as number).toFixed(1)}`)
      .join(' ')
  const gridLines = []
  for (let s = 0; s <= 1; s += 0.25) {
    gridLines.push(
      <g key={s}>
        <line x1={padL} y1={y(s)} x2={W - padR} y2={y(s)} stroke="rgba(255,255,255,0.06)" />
        <text x={padL - 7} y={y(s) + 3.5} textAnchor="end" fontSize="10" fill="#9a988f" style={{ fontFamily: 'monospace' }}>
          {Math.round(s * 100)}%
        </text>
      </g>
    )
  }
  const xTicks = []
  for (let g = 0; g <= 18; g += 3) {
    xTicks.push(
      <text key={g} x={x(g)} y={H - 8} textAnchor="middle" fontSize="10" fill="#9a988f" style={{ fontFamily: 'monospace' }}>
        {g}
      </text>
    )
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="comprehension curve" className="w-full h-auto block">
      {gridLines}
      {xTicks}
      <rect x={x(lo90)} y={padT} width={Math.max(2, x(hi90) - x(lo90))} height={H - padT - padB} fill="#e8e6e1" opacity={0.06} />
      <line x1={x(grade)} y1={padT} x2={x(grade)} y2={H - padB} stroke="#e8e6e1" opacity={0.5} strokeDasharray="3 3" />
      <polyline points={line('us')} fill="none" stroke={COLORS.us} strokeWidth={2.2} />
      <polyline points={line('world')} fill="none" stroke={COLORS.world} strokeWidth={2.2} />
      {usNow != null && <circle cx={x(grade)} cy={y(usNow)} r={5} fill={COLORS.us} stroke="#0b0d11" strokeWidth={2} />}
      {worldNow != null && <circle cx={x(grade)} cy={y(worldNow)} r={5} fill={COLORS.world} stroke="#0b0d11" strokeWidth={2} />}
      <text x={x(grade) + 6} y={padT + 12} fontSize="10.5" fill="#e8e6e1">this text</text>
      <g fontSize="11">
        <rect x={padL + 8} y={padT + 4} width={10} height={3} fill={COLORS.us} />
        <text x={padL + 23} y={padT + 9} fill="#9a988f">US adults</text>
        <rect x={padL + 8} y={padT + 20} width={10} height={3} fill={COLORS.world} />
        <text x={padL + 23} y={padT + 25} fill="#9a988f">World adults</text>
      </g>
    </svg>
  )
}

export function PiaacBar({ rows }: { rows: PiaacRow[] }) {
  const included = rows.reduce((s, r) => s + r.share_of_population * r.fraction_comprehending, 0)
  return (
    <div>
      <div className="flex h-11 rounded-lg overflow-hidden" role="img" aria-label={`${pct(included, 1)} of US adults comprehend`}>
        {rows.map((r) => (
          <div
            key={r.level}
            className="relative"
            style={{ width: `${r.share_of_population * 100}%` }}
            title={`${r.level}: ${Math.round(r.share_of_population * 100)}% of adults — ${Math.round(r.fraction_comprehending * 100)}% of them comprehend`}
          >
            <div
              className="absolute inset-0"
              style={{ background: COLORS.us, opacity: 0.14 + 0.78 * r.fraction_comprehending }}
            />
          </div>
        ))}
      </div>
      <div className="flex mt-2">
        {rows.map((r) => (
          <div
            key={r.level}
            className="text-[10px] text-[#9a988f] text-center overflow-hidden whitespace-nowrap"
            style={{ width: `${r.share_of_population * 100}%` }}
          >
            {r.level.replace('Level ', 'L')}
            <br />
            {Math.round(r.share_of_population * 100)}%
          </div>
        ))}
      </div>
      <p className="text-xs text-[#9a988f] mt-2">
        Reading this text functionally: <b className="text-[#e8e6e1]">{pct(included, 1)}</b> of US adults.
        Source: PIAAC 2023 (NCES).
      </p>
    </div>
  )
}
