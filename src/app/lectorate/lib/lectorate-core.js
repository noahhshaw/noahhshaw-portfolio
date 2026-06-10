/* Lectorate core — browser/Node port of the trained portable model.
   Mirrors src/lectorate/features.py + population.py exactly; parity is
   enforced by tests/test_js_parity.py against the Python pipeline.

   Usage:
     import { Lectorate } from "./lectorate-core.js";
     const eng = await Lectorate.load(assets, model, lexicons);
     const r = eng.analyze(text);
*/

"use strict";

/* ------------------------------------------------ tokenization */

const SENT_SPLIT = /(?<=[.!?…])[\)\]"'”’]*\s+/;
const WORD_RE = /[\p{L}]+(?:['’-][\p{L}]+)*/gu;
const ACRONYM = /^[A-Z]{2,6}$/;

export function splitSentences(text) {
  const blocks = text.split(/\n\s*\n|\r\n\s*\r\n/).map(b => b.trim()).filter(Boolean);
  const sents = [];
  for (let block of blocks) {
    block = block.replace(/\s+/g, " ").trim();
    const parts = block.split(SENT_SPLIT).map(p => p.trim()).filter(Boolean);
    if (parts.length) sents.push(...parts);
    else sents.push(block);
  }
  if (sents.length) return sents;
  const t = text.trim();
  return t ? [t] : [];
}

export function tokenizeWords(sentence) {
  return sentence.match(WORD_RE) || [];
}

export function countSyllables(word) {
  const w = word.toLowerCase();
  if (w.length <= 2) return 1;
  const groups = w.match(/[aeiouy]+/g) || [];
  let n = groups.length;
  if (w.endsWith("e") && !/(le|ee|ye|ie|oe)$/.test(w) && n > 1) n -= 1;
  if (w.endsWith("ed") && n > 1 && w.length > 3 && !"aeiouydt".includes(w[w.length - 3])) n -= 1;
  return Math.max(1, n);
}

/* ------------------------------------------------ small math (parity!) */

const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
function sd(a) {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length);
}
function percentile(sorted, q) {
  if (!sorted.length) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = q * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.min(lo + 1, sorted.length - 1);
  const frac = idx - lo;
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}
const isUpper = (ch) => !!ch && ch.toLowerCase() !== ch;

function dcVariants(w) {
  const out = [w];
  if (w.endsWith("ies") && w.length > 4) out.push(w.slice(0, -3) + "y");
  if (w.endsWith("es") && w.length > 3) out.push(w.slice(0, -2));
  if (w.endsWith("s") && w.length > 3) out.push(w.slice(0, -1));
  if (w.endsWith("ed") && w.length > 4) out.push(w.slice(0, -2), w.slice(0, -1));
  if (w.endsWith("ing") && w.length > 5) out.push(w.slice(0, -3), w.slice(0, -3) + "e");
  return out;
}

const rstrip = (s, chars) => {
  let end = s.length;
  while (end > 0 && chars.includes(s[end - 1])) end--;
  return s.slice(0, end);
};

/* ------------------------------------------------ engine */

export class Lectorate {
  constructor(assets, model, lex) {
    this.assets = assets;
    this.model = model;
    this.zipfTable = lex.zipf;
    this.aoa = lex.aoa;
    this.conc = lex.concreteness;
    this.dc = new Set(lex.dale_chall);
    const W = assets.wordlists;
    this.sets = Object.fromEntries(
      Object.entries(W).map(([k, v]) => [k, new Set(v)])
    );
    this.nominalSuffixes = W.nominal_suffixes;
    this.featureNames = model.feature_names;
    this.medians = model.impute_medians;
  }

  /* fetch-based loader for browsers; pass base URL of the export dir */
  static async load(baseUrl = ".") {
    const get = (f) => fetch(`${baseUrl}/${f}`).then((r) => r.json());
    const [assets, model, zipf, aoa, conc, dc] = await Promise.all([
      get("assets.json"), get("model.json"), get("zipf_en.json"),
      get("aoa.json"), get("concreteness.json"), get("dale_chall.json"),
    ]);
    return new Lectorate(assets, model, {
      zipf, aoa, concreteness: conc, dale_chall: dc,
    });
  }

  _rawZipf(w) {
    let z = this.zipfTable[w] ?? 0;
    if (!z && w.includes("-")) {
      // wordfreq combines multi-token words with a half-harmonic mean of
      // the part frequencies: 1/f = sum(1/f_i)
      const parts = w.split("-").filter(Boolean);
      if (parts.length > 1) {
        const zs = parts.map((p) => this.zipfTable[p] ?? 0);
        if (zs.every((v) => v > 0)) {
          const inv = zs.reduce((s, v) => s + 1 / Math.pow(10, v - 9), 0);
          z = Math.round((Math.log10(1 / inv) + 9) * 100) / 100;
        }
      }
    }
    return z;
  }

  zipf(word) {
    const w = word.replace(/’/g, "'");
    let z = this._rawZipf(w);
    if (w.includes("'")) {
      const base = rstrip(rstrip(w, "s"), "'");
      if (base.length >= 2) z = Math.max(z, this._rawZipf(base));
    }
    return z;
  }

  /* ---------------- features: mirrors features.py extract_features */
  extractFeatures(text) {
    const sentTokens = splitSentences(text).map(tokenizeWords).filter(t => t.length);
    const F = {};
    if (!sentTokens.length) {
      for (const k of this.featureNames) F[k] = 0;
      return F;
    }
    const nSents = sentTokens.length;
    const allTokens = [], properFlags = [];
    for (const toks of sentTokens)
      toks.forEach((t, i) => { allTokens.push(t); properFlags.push(i > 0 && isUpper(t[0])); });

    const nWords = allTokens.length;
    const lowers = allTokens.map(t => t.toLowerCase());
    const wordLens = allTokens.map(t => t.length);
    const sylls = allTokens.map(countSyllables);
    const sentLens = sentTokens.map(t => t.length);
    const sortedSentLens = [...sentLens].sort((a, b) => a - b);

    const ratedIdx = [];
    for (let i = 0; i < nWords; i++) if (!properFlags[i]) ratedIdx.push(i);
    const zipfsAll = ratedIdx.map(i => this.zipf(lowers[i]));
    const inVocab = zipfsAll.filter(z => z > 0);
    const sortedZipf = [...inVocab].sort((a, b) => a - b);
    const nRated = Math.max(1, zipfsAll.length);

    const FW = this.sets.function_words;
    const contentIdx = ratedIdx.filter(i => !FW.has(lowers[i]) && lowers[i].length > 2);
    const contentZipfs = contentIdx.map(i => this.zipf(lowers[i])).filter(z => z > 0).sort((a, b) => a - b);
    const contentWords = contentIdx.map(i => lowers[i]);

    F.n_words = nWords;
    F.n_sents = nSents;
    F.mean_sent_len = mean(sentLens);
    F.sd_sent_len = sd(sentLens);
    F.max_sent_len = Math.max(...sentLens);
    F.p90_sent_len = percentile(sortedSentLens, 0.9);
    F.mean_word_len = mean(wordLens);
    F.sd_word_len = sd(wordLens);
    F.mean_syll = mean(sylls);
    F.sd_syll = sd(sylls);
    F.share_long7 = wordLens.filter(L => L >= 7).length / nWords;
    const nPoly = sylls.filter(s => s >= 3).length;
    F.share_poly3 = nPoly / nWords;

    F.zipf_mean = mean(inVocab);
    F.zipf_median = percentile(sortedZipf, 0.5);
    F.zipf_p10 = percentile(sortedZipf, 0.1);
    F.zipf_p25 = percentile(sortedZipf, 0.25);
    F.share_zipf_lt3 = inVocab.filter(z => z < 3).length / nRated;
    F.share_zipf_lt4 = inVocab.filter(z => z < 4).length / nRated;
    F.share_zipf_lt5 = inVocab.filter(z => z < 5).length / nRated;
    F.zipf_content_mean = mean(contentZipfs);
    F.zipf_content_p10 = percentile(contentZipfs, 0.1);
    F.share_oov = (zipfsAll.length - inVocab.length) / nRated;

    const aoaVals = contentWords.filter(w => w in this.aoa).map(w => this.aoa[w]).sort((a, b) => a - b);
    F.aoa_mean = mean(aoaVals);
    F.aoa_p90 = percentile(aoaVals, 0.9);
    F.share_aoa_gt10 = aoaVals.filter(v => v > 10).length / Math.max(1, aoaVals.length);
    F.aoa_coverage = aoaVals.length / Math.max(1, contentWords.length);

    const concVals = contentWords.filter(w => w in this.conc).map(w => this.conc[w]).sort((a, b) => a - b);
    F.conc_mean = mean(concVals);
    F.conc_p10 = percentile(concVals, 0.1);
    F.share_abstract = concVals.filter(v => v < 2.5).length / Math.max(1, concVals.length);

    const known = ratedIdx.filter(i => dcVariants(lowers[i]).some(v => this.dc.has(v))).length;
    F.dc_known_share = known / nRated;
    const pctDifficult = 100 * (1 - F.dc_known_share);

    const types = new Set(lowers);
    F.guiraud = types.size / Math.sqrt(nWords);
    const counts = {};
    for (const w of lowers) counts[w] = (counts[w] || 0) + 1;
    const cvals = Object.values(counts);
    F.hapax_share = cvals.filter(c => c === 1).length / nWords;
    F.repetition_top10 = cvals.sort((a, b) => b - a).slice(0, 10).reduce((s, v) => s + v, 0) / nWords;

    const countCh = (s, ch) => s.split(ch).length - 1;
    F.commas_per_sent = countCh(text, ",") / nSents;
    F.heavy_punct_per_1k = 1000 * (countCh(text, ";") + countCh(text, ":") + countCh(text, "—") + countCh(text, "--")) / nWords;
    F.parens_per_1k = 1000 * countCh(text, "(") / nWords;

    const S = this.sets;
    F.subordinators_per_1k = 1000 * lowers.filter(w => S.subordinators.has(w)).length / nWords;
    F.connectives_per_1k = 1000 * lowers.filter(w => S.connectives.has(w)).length / nWords;
    F.coordinators_per_word = lowers.filter(w => S.coordinators.has(w)).length / nWords;
    F.pronouns_per_word = lowers.filter(w => S.pronouns.has(w)).length / nWords;
    F.prepositions_per_word = lowers.filter(w => S.prepositions.has(w)).length / nWords;
    F.modals_per_1k = 1000 * lowers.filter(w => S.modals.has(w)).length / nWords;
    F.nominalization_share = lowers.filter(
      w => w.length >= 8 && this.nominalSuffixes.some(s => w.endsWith(s))
    ).length / nWords;

    let passives = 0;
    for (const toks of sentTokens) {
      const lw = toks.map(t => t.toLowerCase());
      for (let i = 0; i < lw.length; i++) {
        if (S.be_forms.has(lw[i])) {
          const win = lw.slice(i + 1, i + 4);
          if (win.some(v => (v.endsWith("ed") && v.length > 3) || S.irregular_participles.has(v))) {
            passives++;
            break;
          }
        }
      }
    }
    F.passive_per_sent = passives / nSents;
    F.share_sents_long25 = sentLens.filter(L => L >= 25).length / nSents;

    const msl = F.mean_sent_len, msyll = F.mean_syll;
    const nChars = wordLens.reduce((s, v) => s + v, 0);
    F.flesch_reading_ease = 206.835 - 1.015 * msl - 84.6 * msyll;
    F.fk_grade = 0.39 * msl + 11.8 * msyll - 15.59;
    F.smog = 1.043 * Math.sqrt(nPoly * 30 / nSents) + 3.1291;
    F.ari = 4.71 * (nChars / nWords) + 0.5 * msl - 21.43;
    const Lh = 100 * nChars / nWords, Sh = 100 * nSents / nWords;
    F.coleman_liau = 0.0588 * Lh - 0.296 * Sh - 15.8;
    F.gunning_fog = 0.4 * (msl + 100 * F.share_poly3);
    const long6 = allTokens.filter(t => t.length > 6).length;
    F.lix = msl + 100 * long6 / nWords;
    F.rix = allTokens.filter(t => t.length >= 7).length / nSents;
    let dcScore = 0.1579 * pctDifficult + 0.0496 * msl;
    if (pctDifficult > 5) dcScore += 3.6365;
    F.dale_chall_score = dcScore;

    const overlaps = [];
    let prev = null;
    for (const toks of sentTokens) {
      const cur = new Set(toks.map(t => t.toLowerCase()).filter(w => !FW.has(w) && w.length > 2));
      if (prev !== null && (prev.size || cur.size)) {
        const union = new Set([...prev, ...cur]);
        let inter = 0;
        for (const w of prev) if (cur.has(w)) inter++;
        overlaps.push(union.size ? inter / union.size : 0);
      }
      prev = cur;
    }
    F.adjacent_overlap = mean(overlaps);

    const rawTokens = text.match(/\S+/g) || [];
    F.digits_per_word = rawTokens.filter(t => /\d/.test(t)).length / Math.max(1, rawTokens.length);
    F.acronym_share = allTokens.filter(t => ACRONYM.test(t)).length / nWords;
    F.mean_log_sent_len = mean(sentLens.map(L => Math.log(1 + L)));
    return F;
  }

  /* ---------------- GBM inference */
  predictFromFeatures(F) {
    const x = this.featureNames.map(k => {
      const v = F[k];
      return Number.isFinite(v) ? v : this.medians[k];
    });
    let pred = this.model.base;
    const lr = this.model.lr;
    for (const tr of this.model.trees) {
      let n = 0;
      while (tr.cl[n] !== -1) n = x[tr.f[n]] <= tr.t[n] ? tr.cl[n] : tr.cr[n];
      pred += lr * tr.v[n];
    }
    return pred;
  }

  gradeFromDifficulty(d) {
    const g = this.model.grade_table;
    const idx = (d - g.grid_start) / g.grid_step;
    if (idx <= 0) return g.grades[0];
    if (idx >= g.grades.length - 1) return g.grades[g.grades.length - 1];
    const lo = Math.floor(idx), frac = idx - lo;
    return g.grades[lo] * (1 - frac) + g.grades[lo + 1] * frac;
  }

  windows(text, target = 170) {
    if (text.split(/\s+/).filter(Boolean).length <= 280) return [text];
    const chunks = [];
    let cur = [], curN = 0;
    for (const s of splitSentences(text)) {
      const n = s.split(/\s+/).filter(Boolean).length;
      cur.push(s); curN += n;
      if (curN >= target) { chunks.push(cur.join(" ")); cur = []; curN = 0; }
    }
    if (cur.length && curN >= 50) chunks.push(cur.join(" "));
    else if (cur.length && chunks.length) chunks[chunks.length - 1] += " " + cur.join(" ");
    return chunks.length ? chunks : [text];
  }

  predictDifficulty(text) {
    const wins = this.windows(text);
    const wts = wins.map(w => w.split(/\s+/).filter(Boolean).length);
    const tot = wts.reduce((s, v) => s + v, 0);
    let d = 0;
    for (let i = 0; i < wins.length; i++)
      d += (wts[i] / tot) * this.predictFromFeatures(this.extractFeatures(wins[i]));
    return d;
  }

  /* ---------------- population layer (mirrors population.py) */

  _cdf(tableName, score) {
    const T = this.assets.tables;
    const arr = T[tableName];
    const s = Math.min(480, Math.max(60, score));
    const idx = s - T.score_grid_start;
    const lo = Math.floor(idx), frac = idx - lo;
    const hi = Math.min(lo + 1, arr.length - 1);
    return arr[lo] * (1 - frac) + arr[hi] * frac;
  }

  gradeToScore(grade) {
    const T = this.assets.tables;
    const g = Math.min(20, Math.max(0, grade));
    const idx = g / T.grade_grid_step;
    const lo = Math.floor(idx), frac = idx - lo;
    const arr = T.grade_to_score;
    const hi = Math.min(lo + 1, arr.length - 1);
    return arr[lo] * (1 - frac) + arr[hi] * frac;
  }

  comprehension(grade, lang = "en", standard = "functional") {
    const P = this.assets.population;
    const shift = P.comprehension_standards[standard].score_shift;
    const score = this.gradeToScore(grade) + shift;
    const W = P.world;
    const L = P.languages[lang];
    const usAbove = 1 - this._cdf("us_cdf", score);
    const oecdAbove = (s) => 1 - this._cdf("oecd_cdf", s);

    let usShare;
    if (lang === "en") usShare = usAbove;
    else {
      const share = P.us_language_shares[lang] ?? P.us_language_shares._default_other;
      usShare = share * P.us_language_shares._written_literacy_factor * usAbove;
    }
    const out = { grade, score, us_share: usShare };
    if (!L) return out;

    const lit = P.language_region_literacy[lang] ?? W.adult_literacy_rate;
    const nativeM = L.native_m * W.speaker_adult_fraction;
    const l2M = Math.max(0, L.total_m - L.native_m) * W.speaker_adult_fraction;
    const ceilFactor = (g, ceil, soft = 1.25) =>
      g <= ceil - soft ? 1 : g >= ceil + soft ? 0 : (ceil + soft - g) / (2 * soft);

    let pNat, pL2;
    if (lang === "en") {
      pNat = 0.5 * usAbove + 0.5 * oecdAbove(score);
      const bands = P.english_l2_proficiency.bands;
      const general = oecdAbove(score + W.world_native_shift_points);
      let total = 0;
      for (const b of Object.values(bands)) total += b.share * ceilFactor(grade, b.grade_ceiling);
      pL2 = P.english_l2_proficiency.within_band_literacy * total *
        Math.sqrt(Math.max(0.35, general));
    } else {
      const worldNative = (s) => lit * oecdAbove(s + W.world_native_shift_points);
      pNat = worldNative(score);
      pL2 = worldNative(score) * ceilFactor(grade, P.non_english_l2_discount.grade_ceiling);
    }
    const comprehendersM = nativeM * pNat + l2M * pL2;
    out.speaker_share = comprehendersM / Math.max(1e-9, nativeM + l2M);
    out.world_share = (comprehendersM * 1e6) / W.adults_15plus;
    out.world_count = comprehendersM * 1e6;
    out.us_count = usShare * P.us_population.adults_16_65;
    return out;
  }

  /* ---------------- sentence heatmap (mirrors sentences.py) */

  scoreSentences(text, docGrade) {
    const FW = this.sets.function_words;
    const out = [];
    for (const sent of splitSentences(text)) {
      const toks = tokenizeWords(sent);
      const n = toks.length;
      if (!n) continue;
      if (n < 6) {
        out.push({ text: sent, grade: docGrade, n_words: n, issues: [] });
        continue;
      }
      const F = this.extractFeatures(sent);
      const gRaw = this.gradeFromDifficulty(this.predictFromFeatures(F));
      const w = Math.min(0.7, 0.25 + n / 60);
      const grade = w * gRaw + (1 - w) * docGrade;
      const issues = [];
      if (n >= 35) issues.push({ type: "very_long", detail: `${n} words in one sentence` });
      else if (n >= 25) issues.push({ type: "long", detail: `${n} words` });
      const rare = toks
        .map((t, i) => [t, i])
        .filter(([t, i]) => t.length > 3 && !(i > 0 && isUpper(t[0]))
          && !FW.has(t.toLowerCase()))
        .map(([t]) => [t, this.zipf(t.toLowerCase())])
        .filter(([, z]) => z > 0 && z < 3.6)
        .sort((a, b) => a[1] - b[1]);
      if (rare.length)
        issues.push({ type: "rare_words", detail: rare.slice(0, 4).map(r => r[0]).join(", ") });
      if (F.passive_per_sent > 0) issues.push({ type: "passive", detail: "passive construction" });
      if (F.nominalization_share > 0.08)
        issues.push({ type: "nominalizations", detail: "dense abstract noun forms" });
      out.push({ text: sent, grade: Math.round(grade * 10) / 10, n_words: n, issues });
    }
    return out;
  }

  wordFlags(text, k = 12) {
    const FW = this.sets.function_words;
    const seen = new Map();
    for (const sent of splitSentences(text)) {
      const toks = tokenizeWords(sent);
      toks.forEach((t, i) => {
        const w = t.toLowerCase();
        if (w.length < 5 || FW.has(w) || seen.has(w) || (i > 0 && isUpper(t[0]))
            || w.includes("'") || w.includes("’")) return;
        const z = this.zipf(w);
        let kind;
        if (z === 0 && !(w in this.aoa)) kind = "unrecognized";
        else if (z < 3.8) kind = "rare";
        else return;
        const entry = { word: w, zipf: Math.round(z * 100) / 100, kind,
                        syllables: countSyllables(w) };
        if (w in this.aoa) entry.aoa = this.aoa[w];
        if (w in this.conc) entry.concreteness = this.conc[w];
        seen.set(w, entry);
      });
    }
    return [...seen.values()]
      .sort((a, b) => a.zipf - b.zipf || (b.aoa ?? 0) - (a.aoa ?? 0))
      .slice(0, k);
  }

  piaacBreakdown(grade, standard = "functional") {
    const P = this.assets.population;
    const score = this.gradeToScore(grade)
      + P.comprehension_standards[standard].score_shift;
    const shares = P.us_literacy_2023.level_shares;
    const bounds = [
      ["below_L1", "Below Level 1", 60, 176], ["L1", "Level 1", 176, 226],
      ["L2", "Level 2", 226, 276], ["L3", "Level 3", 276, 326],
      ["L4_5", "Level 4/5", 326, 480],
    ];
    return bounds.map(([key, label, lo, hi]) => {
      let frac;
      if (score <= lo) frac = 1;
      else if (score >= hi) frac = 0;
      else {
        const cLo = this._cdf("us_cdf", lo), cHi = this._cdf("us_cdf", hi);
        frac = (cHi - this._cdf("us_cdf", score)) / Math.max(1e-9, cHi - cLo);
      }
      return { level: label, share_of_population: shares[key],
               fraction_comprehending: Math.min(1, Math.max(0, frac)) };
    });
  }

  curve(lang = "en", standard = "functional", step = 0.25) {
    const pts = [];
    for (let g = 0; g <= 18 + 1e-9; g += step) {
      const c = this.comprehension(g, lang, standard);
      pts.push({ grade: Math.round(g * 100) / 100, us: c.us_share,
                 world: c.world_share ?? null, speakers: c.speaker_share ?? null });
    }
    return pts;
  }

  analyze(text, { standard = "functional", targetGrade = 8 } = {}) {
    const d = this.predictDifficulty(text);
    const q90 = this.model.conformal_q90, q50 = this.model.conformal_q50;
    const grade = this.gradeFromDifficulty(d);
    const pop = this.comprehension(grade, "en", standard);
    const cf = this.comprehension(targetGrade, "en", standard);
    const F = this.extractFeatures(text);

    const warnings = [];
    const nWords = text.trim().split(/\s+/).filter(Boolean).length;
    if (nWords < 30)
      warnings.push("Text under 30 words: estimates are unstable at this length.");
    // cheap English guard: the browser build ships English tables only
    if (F.n_words >= 15 && (F.zipf_mean < 4.0 || F.share_oov > 0.35))
      warnings.push("This may not be English (or is very unusual text) — the "
        + "browser model is English-only; treat results with caution.");

    return {
      difficulty: d,
      grade,
      grade_interval_90: [this.gradeFromDifficulty(d - q90), this.gradeFromDifficulty(d + q90)],
      grade_interval_50: [this.gradeFromDifficulty(d - q50), this.gradeFromDifficulty(d + q50)],
      population: pop,
      counterfactual: {
        target_grade: targetGrade,
        delta_us_pp: (cf.us_share - pop.us_share) * 100,
        delta_world_pp: ((cf.world_share ?? 0) - (pop.world_share ?? 0)) * 100,
      },
      piaac: this.piaacBreakdown(grade, standard),
      sentences: this.scoreSentences(text, grade),
      word_flags: this.wordFlags(text),
      formulas: {
        flesch_reading_ease: Math.round(F.flesch_reading_ease * 10) / 10,
        flesch_kincaid_grade: Math.round(F.fk_grade * 10) / 10,
        smog: Math.round(F.smog * 10) / 10,
        gunning_fog: Math.round(F.gunning_fog * 10) / 10,
        ari: Math.round(F.ari * 10) / 10,
        coleman_liau: Math.round(F.coleman_liau * 10) / 10,
        dale_chall: Math.round(F.dale_chall_score * 10) / 10,
      },
      stats: {
        n_words: F.n_words, n_sents: F.n_sents,
        mean_sent_len: Math.round(F.mean_sent_len * 10) / 10,
        share_passive: Math.round(F.passive_per_sent * 100) / 100,
        share_rare: Math.round(F.share_zipf_lt4 * 1000) / 1000,
      },
      warnings,
    };
  }
}
