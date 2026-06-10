'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Lectorate,
  type AnalysisResult,
  type SentenceScore,
  type Standard,
} from './lib/lectorate-core'
import samples from './lib/samples.json'
import {
  COLORS,
  CurveChart,
  Donut,
  GradeScale,
  PiaacBar,
  gradeColor,
  gradeLabel,
  pct,
} from './components/viz'

type Sample = { id: string; title: string; text: string }

const STANDARDS: { key: Standard; label: string }[] = [
  { key: 'strict', label: 'Strict' },
  { key: 'functional', label: 'Functional' },
  { key: 'partial', label: 'Partial' },
]

export default function LectorateClient() {
  const engineRef = useRef<Lectorate | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [text, setText] = useState('')
  const [standard, setStandard] = useState<Standard>('functional')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [targetGrade, setTargetGrade] = useState(8)
  const [selected, setSelected] = useState<SentenceScore | null>(null)

  useEffect(() => {
    let cancelled = false
    Lectorate.load('/lectorate')
      .then((eng) => {
        if (cancelled) return
        engineRef.current = eng
        setStatus('ready')
      })
      .catch(() => !cancelled && setStatus('failed'))
    return () => {
      cancelled = true
    }
  }, [])

  const curve = useMemo(() => {
    if (status !== 'ready' || !engineRef.current) return null
    return engineRef.current.curve('en', standard)
  }, [status, standard])

  const runAnalysis = (input: string, std: Standard) => {
    const eng = engineRef.current
    if (!eng || input.trim().split(/\s+/).filter(Boolean).length < 5) return
    setAnalyzing(true)
    setSelected(null)
    // yield a frame so the button state paints before the ~100ms of math
    setTimeout(() => {
      setResult(eng.analyze(input, { standard: std }))
      setAnalyzing(false)
    }, 30)
  }

  const cf = useMemo(() => {
    if (!result || !curve) return null
    const at = curve.reduce((best, p) =>
      Math.abs(p.grade - targetGrade) < Math.abs(best.grade - targetGrade) ? p : best
    )
    return {
      dUs: (at.us ?? 0) - result.population.us_share,
      dWorld: (at.world ?? 0) - (result.population.world_share ?? 0),
    }
  }, [result, curve, targetGrade])

  return (
    <div className="min-h-screen bg-[#0b0d11] text-[#e8e6e1]">
      <header className="flex flex-wrap items-baseline justify-between gap-2 px-6 py-6 border-b border-white/10 md:px-10">
        <div className="flex items-baseline gap-3">
          <span className="font-serif text-2xl font-bold">Lectorate</span>
          <span className="font-serif italic text-sm text-[#9a988f]">
            polling the world&apos;s readers
          </span>
        </div>
        <Link href="/" className="text-xs text-[#9a988f] hover:text-[#e8e6e1] transition-colors">
          ← noahhshaw.com
        </Link>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 md:px-6">
        <p className="mb-6 max-w-2xl text-sm leading-relaxed text-[#9a988f]">
          Paste any English text — a benefits notice, a privacy policy, a homework page — and a
          model trained on 111,000 human difficulty judgments estimates the share of the{' '}
          <b className="text-[#e8e6e1]">US adult population</b> and the{' '}
          <b className="text-[#e8e6e1]">world&apos;s adults</b> who could read and functionally
          understand it. Everything runs in your browser: the model weights, the
          psycholinguistic lexicons, and the PIAAC literacy survey tables were loaded with this
          page. No text leaves your device.
        </p>

        {/* input */}
        <section className="rounded-2xl border border-white/10 bg-[#13161c] p-4 md:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="lec-sample" className="text-xs font-semibold uppercase tracking-wider text-[#9a988f]">
              Try a sample
            </label>
            <select
              id="lec-sample"
              className="rounded-lg border border-white/10 bg-[#181c24] px-3 py-1.5 text-sm"
              defaultValue=""
              onChange={(e) => {
                const s = (samples as Sample[]).find((x) => x.id === e.target.value)
                if (s) {
                  setText(s.text)
                  runAnalysis(s.text, standard)
                }
              }}
            >
              <option value="" disabled>
                Load a sample…
              </option>
              {(samples as Sample[]).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            spellCheck={false}
            placeholder="Paste the text of a webpage, notice, form letter, or policy here…"
            className="w-full resize-y rounded-xl border border-white/10 bg-[#181c24] p-4 text-[15px] leading-relaxed outline-none focus:ring-2 focus:ring-[#e8b16b]"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div role="radiogroup" aria-label="Comprehension standard" className="flex items-center">
              <span className="mr-2 text-xs font-semibold uppercase tracking-wider text-[#9a988f]">
                Standard
              </span>
              {STANDARDS.map((s, i) => (
                <button
                  key={s.key}
                  role="radio"
                  aria-checked={standard === s.key}
                  onClick={() => {
                    setStandard(s.key)
                    if (result) runAnalysis(text, s.key)
                  }}
                  className={`border border-white/10 px-3 py-1.5 text-xs font-semibold transition-colors ${
                    i === 0 ? 'rounded-l-lg' : i === STANDARDS.length - 1 ? 'rounded-r-lg border-l-0' : 'border-l-0'
                  } ${standard === s.key ? 'bg-[#e8e6e1] text-[#0b0d11]' : 'text-[#9a988f] hover:text-[#e8e6e1]'}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => runAnalysis(text, standard)}
              disabled={status !== 'ready' || analyzing}
              className="rounded-lg bg-[#e8b16b] px-6 py-2 text-sm font-bold text-[#1a1206] transition-opacity disabled:cursor-wait disabled:opacity-50"
            >
              {status === 'loading' ? 'Loading model…' : analyzing ? 'Analyzing…' : 'Analyze'}
            </button>
          </div>
          {status === 'failed' && (
            <p className="mt-3 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-300">
              The model assets failed to load — try refreshing.
            </p>
          )}
          {status === 'loading' && (
            <p className="mt-3 text-xs text-[#9a988f]">
              Fetching the trained model + lexicons (~2&nbsp;MB compressed, one-time, cached after that)…
            </p>
          )}
        </section>

        {/* results */}
        {result && curve && (
          <div className="mt-6 space-y-4">
            {result.warnings.map((w) => (
              <p key={w} className="rounded-lg border border-yellow-400/25 bg-yellow-400/10 px-3 py-2 text-xs text-yellow-200">
                {w}
              </p>
            ))}

            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <GaugeCard
                label="US adults"
                share={result.population.us_share}
                color={COLORS.us}
                sub={`≈ ${fmtCount(result.population.us_count)} of ~210M adults 16–65`}
              />
              <GaugeCard
                label="World adults"
                share={result.population.world_share ?? 0}
                color={COLORS.world}
                sub={`≈ ${fmtCount(result.population.world_count)} of ~6.3B adults 15+`}
              />
              <GaugeCard
                label="English speakers"
                share={result.population.speaker_share ?? 0}
                color={COLORS.speakers}
                sub="adult speakers worldwide"
              />
              <div className="rounded-2xl border border-white/10 bg-[#13161c] p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#9a988f]">
                  Difficulty
                </h3>
                <div className="mt-1 font-serif text-3xl font-bold" style={{ color: gradeColor(result.grade) }}>
                  grade {result.grade.toFixed(1)}
                </div>
                <div className="mt-0.5 text-xs text-[#9a988f]">
                  {gradeLabel(result.grade)} · 90% interval {result.grade_interval_90[0].toFixed(1)}–{result.grade_interval_90[1].toFixed(1)}
                </div>
                <div className="mt-3">
                  <GradeScale
                    g={result.grade}
                    lo90={result.grade_interval_90[0]}
                    hi90={result.grade_interval_90[1]}
                    lo50={result.grade_interval_50[0]}
                    hi50={result.grade_interval_50[1]}
                  />
                </div>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
              <div className="rounded-2xl border border-white/10 bg-[#13161c] p-5">
                <h2 className="font-serif text-lg font-semibold">Comprehension curve</h2>
                <p className="mb-3 text-xs text-[#9a988f]">
                  Share of each population able to comprehend text, by grade-equivalent
                  difficulty. The band is this text&apos;s 90% interval.
                </p>
                <CurveChart
                  curve={curve}
                  grade={result.grade}
                  lo90={result.grade_interval_90[0]}
                  hi90={result.grade_interval_90[1]}
                  usNow={result.population.us_share}
                  worldNow={result.population.world_share}
                />
                {cf && (
                  <div className="mt-4 border-t border-dashed border-white/10 pt-4 text-sm">
                    <b>What if you rewrote it?</b> Target grade{' '}
                    <input
                      type="range"
                      min={3}
                      max={14}
                      step={1}
                      value={targetGrade}
                      aria-label="target grade"
                      onChange={(e) => setTargetGrade(+e.target.value)}
                      className="mx-2 w-36 accent-[#e8b16b] align-middle"
                    />
                    <b>{targetGrade}</b> → US <Delta v={cf.dUs} /> · World <Delta v={cf.dWorld} />{' '}
                    <span className="text-xs text-[#9a988f]">
                      ({cf.dUs >= 0 ? '+' : ''}
                      {Math.round(cf.dUs * 210)}M US adults)
                    </span>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#13161c] p-5">
                <h2 className="font-serif text-lg font-semibold">Who is included</h2>
                <p className="mb-3 text-xs text-[#9a988f]">
                  US adults by PIAAC 2023 literacy level. Solid = can comprehend this text.
                </p>
                <PiaacBar rows={result.piaac} />
                <h2 className="mt-6 font-serif text-lg font-semibold">
                  Classic formulas <span className="text-xs font-normal text-[#9a988f]">(for reference)</span>
                </h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.entries({
                    'Flesch ease': result.formulas.flesch_reading_ease,
                    'FK grade': result.formulas.flesch_kincaid_grade,
                    SMOG: result.formulas.smog,
                    Fog: result.formulas.gunning_fog,
                    ARI: result.formulas.ari,
                    'Dale-Chall': result.formulas.dale_chall,
                  }).map(([k, v]) => (
                    <span key={k} className="rounded-lg border border-white/10 bg-[#181c24] px-2.5 py-1 font-mono text-xs text-[#9a988f]">
                      {k} <b className="font-medium text-[#e8e6e1]">{v}</b>
                    </span>
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#13161c] p-5">
              <h2 className="font-serif text-lg font-semibold">Sentence heatmap</h2>
              <p className="mb-3 text-xs text-[#9a988f]">
                Color = estimated grade demand of each sentence. Click a sentence for its issues.
              </p>
              <div className="rounded-xl bg-[#181c24] p-4 text-[15px] leading-[1.9]">
                {result.sentences.map((s, i) => {
                  const c = gradeColor(s.grade)
                  const isSel = selected === s
                  return (
                    <button
                      key={`${i}-${s.text.slice(0, 24)}`}
                      onClick={() => setSelected(isSel ? null : s)}
                      className={`inline rounded px-0.5 py-0.5 text-left ${isSel ? 'outline outline-2 outline-[#e8e6e1]' : 'hover:outline hover:outline-1 hover:outline-white/35'}`}
                      style={{
                        background: c.replace('rgb', 'rgba').replace(')', ',0.16)'),
                        boxShadow: `inset 0 -2px 0 ${c.replace('rgb', 'rgba').replace(')', ',0.55)')}`,
                      }}
                      aria-label={`sentence, grade ${s.grade.toFixed(1)}`}
                    >
                      {s.text}{' '}
                    </button>
                  )
                })}
              </div>
              {selected && (
                <div className="mt-3 rounded-xl border border-white/10 bg-[#181c24] px-4 py-3 text-sm">
                  <b style={{ color: gradeColor(selected.grade) }}>grade {selected.grade.toFixed(1)}</b>
                  <span className="text-xs text-[#9a988f]"> · {selected.n_words} words</span>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {selected.issues.length ? (
                      selected.issues.map((iss) => (
                        <span key={iss.type} className="rounded-full border border-red-300/30 bg-red-300/10 px-2.5 py-0.5 text-xs font-semibold text-red-300">
                          {ISSUE_LABELS[iss.type] ?? iss.type}
                          {iss.detail ? `: ${iss.detail}` : ''}
                        </span>
                      ))
                    ) : (
                      <span className="rounded-full border border-sky-300/30 bg-sky-300/10 px-2.5 py-0.5 text-xs font-semibold text-sky-300">
                        No specific issues — difficulty comes from overall vocabulary and structure.
                      </span>
                    )}
                  </div>
                </div>
              )}
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-[#13161c] p-5">
                <h2 className="font-serif text-lg font-semibold">Hardest vocabulary</h2>
                <p className="mb-3 text-xs text-[#9a988f]">
                  Ranked by corpus rarity (Zipf) and the age people typically learn the word.
                </p>
                {result.word_flags.length ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-left text-[10px] uppercase tracking-wider text-[#9a988f]">
                        <th className="py-1.5 pr-2 font-semibold">word</th>
                        <th className="py-1.5 pr-2 font-semibold">zipf</th>
                        <th className="py-1.5 pr-2 font-semibold">learned at</th>
                        <th className="py-1.5 font-semibold">flag</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.word_flags.map((w) => (
                        <tr key={w.word} className="border-b border-white/5">
                          <td className="py-1.5 pr-2 font-semibold">{w.word}</td>
                          <td className="py-1.5 pr-2 font-mono text-xs text-[#9a988f]">{w.zipf > 0 ? w.zipf : '—'}</td>
                          <td className="py-1.5 pr-2 font-mono text-xs text-[#9a988f]">{w.aoa ? `age ${Math.round(w.aoa)}` : '—'}</td>
                          <td className={`py-1.5 font-mono text-xs ${w.kind === 'rare' ? 'text-[#e8b16b]' : 'text-red-300'}`}>{w.kind}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-sm text-[#9a988f]">No unusually rare vocabulary detected.</p>
                )}
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#13161c] p-5 text-sm text-[#9a988f]">
                <h2 className="font-serif text-lg font-semibold text-[#e8e6e1]">Method &amp; honesty notes</h2>
                <ul className="mt-2 list-disc space-y-2 pl-5 text-[13px] leading-relaxed">
                  <li>
                    <b className="text-[#e8e6e1]">Difficulty model:</b> gradient-boosted trees over 58
                    psycholinguistic features, trained on the CLEAR corpus (4,724 excerpts ranked by
                    ~111k pairwise teacher judgments); 94% ordering accuracy on professionally
                    simplified rewrites it never saw.
                  </li>
                  <li>
                    <b className="text-[#e8e6e1]">US share:</b> PIAAC 2023 adult literacy survey
                    (28% of US adults now read at or below Level 1).
                  </li>
                  <li>
                    <b className="text-[#e8e6e1]">World share:</b> Ethnologue 2025 speaker counts ×
                    UNESCO literacy × an OECD skill curve shifted by the global schooling gap. The
                    second-language English bands are the loosest assumption.
                  </li>
                  <li>
                    <b className="text-[#e8e6e1]">Intervals</b> are conformal predictions from
                    held-out residuals — honest 90% bands, not decoration.
                  </li>
                  <li>
                    Linguistic difficulty only: topic familiarity, motivation, and layout are out of
                    scope. Estimates, not oracle truth.
                  </li>
                </ul>
              </div>
            </section>
          </div>
        )}

        {!result && (
          <p className="mt-10 max-w-xl text-sm text-[#9a988f]">
            Load a sample above to see it work — the bureaucratic benefits notice vs. its
            plain-language rewrite is the one to try: same content, a ~100-million-reader
            difference.
          </p>
        )}
      </main>

      <footer className="border-t border-white/10 px-6 py-5 font-mono text-[11px] text-[#9a988f] md:px-10">
        Model trained locally on an M1 MacBook · CLEAR corpus · PIAAC 2023 · UNESCO · Ethnologue
        2025 · runs entirely client-side
      </footer>
    </div>
  )
}

const ISSUE_LABELS: Record<string, string> = {
  very_long: 'Very long sentence',
  long: 'Long sentence',
  rare_words: 'Rare words',
  passive: 'Passive voice',
  nominalizations: 'Nominalization-heavy',
}

function GaugeCard({
  label, share, color, sub,
}: {
  label: string; share: number; color: string; sub: string
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-white/10 bg-[#13161c] p-4 text-center">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#9a988f]">{label}</div>
      <Donut share={share} color={color} />
      <div className="mt-1 text-xs text-[#9a988f]">{sub}</div>
    </div>
  )
}

function Delta({ v }: { v: number }) {
  return (
    <span className={`font-semibold ${v >= 0 ? 'text-green-400' : 'text-red-400'}`}>
      {v >= 0 ? '+' : ''}
      {(v * 100).toFixed(1)}pp
    </span>
  )
}

function fmtCount(c?: number): string {
  if (c == null) return '—'
  if (c >= 1e9) return `${(c / 1e9).toFixed(2)}B`
  if (c >= 1e6) return `${Math.round(c / 1e6)}M`
  return `${Math.round(c / 1e3)}K`
}
