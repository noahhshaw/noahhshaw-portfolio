/* Type surface for the framework-free Lectorate engine (lectorate-core.js).
   The .js file is the parity-tested artifact copied from the lectorate repo —
   edit it there (~/Projects/lectorate/web-export) and re-copy, never here. */

export interface PopulationResult {
  grade: number
  score: number
  us_share: number
  world_share?: number
  speaker_share?: number
  us_count?: number
  world_count?: number
}

export interface SentenceIssue {
  type: 'very_long' | 'long' | 'rare_words' | 'passive' | 'nominalizations'
  detail: string
}

export interface SentenceScore {
  text: string
  grade: number
  n_words: number
  issues: SentenceIssue[]
}

export interface WordFlag {
  word: string
  zipf: number
  kind: 'rare' | 'unrecognized'
  syllables: number
  aoa?: number
  concreteness?: number
}

export interface PiaacRow {
  level: string
  share_of_population: number
  fraction_comprehending: number
}

export interface CurvePoint {
  grade: number
  us: number
  world: number | null
  speakers: number | null
}

export interface AnalysisResult {
  difficulty: number
  grade: number
  grade_interval_90: [number, number]
  grade_interval_50: [number, number]
  population: PopulationResult
  counterfactual: {
    target_grade: number
    delta_us_pp: number
    delta_world_pp: number
  }
  piaac: PiaacRow[]
  sentences: SentenceScore[]
  word_flags: WordFlag[]
  formulas: Record<string, number>
  stats: {
    n_words: number
    n_sents: number
    mean_sent_len: number
    share_passive: number
    share_rare: number
  }
  warnings: string[]
}

export type Standard = 'strict' | 'functional' | 'partial'

export class Lectorate {
  static load(baseUrl?: string): Promise<Lectorate>
  analyze(
    text: string,
    opts?: { standard?: Standard; targetGrade?: number }
  ): AnalysisResult
  comprehension(grade: number, lang?: string, standard?: Standard): PopulationResult
  curve(lang?: string, standard?: Standard, step?: number): CurvePoint[]
  piaacBreakdown(grade: number, standard?: Standard): PiaacRow[]
  model: { cv: { pearson: number; rmse: number }; version: string }
}
