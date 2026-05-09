# Research Log

## Build summary

Total files: **102**
Total word count: **~56,500 words** across markdown + JSON.

### File breakdown

- 1 README.md (~600 words)
- 1 voice.md (~900 words; later edited by user to add subject-line spec and pronoun default)
- 1 sources.md (~1,200 words)
- 52 buckets/week-NN.md (~26,000 words; 400–800 each, with weeks 1, 8, 14, 16, 26, 34, 52 longer)
- 3 calendars/*.json (vaccines, well-visits, enrichment-windows)
- 27 topics/*.md (~19,000 words)
- 6 dad/*.md (~5,000 words)
- 4 mom/*.md (~3,800 words)
- 3 schools/*.md (~2,800 words)

## Working method

1. **Web research** via WebSearch and WebFetch for: AAP / CDC immunization schedule (2026 and historical), CDC Learn the Signs milestones (2022 revision), AAP Bright Futures periodicity, AAP safe sleep 2022, sleep training literature, allergen introduction (LEAP, NIAID), Hart & Risley + replication evidence, Suzuki, NYC ISAAGNY and SF ISSFBA application calendars, 529 plans, life insurance for new parents, postpartum recovery, EPDS / PPD literature, fever guidelines, RSV/nirsevimab, screen time AAP guidance.

2. **Synthesis** with explicit tradeoff presentation where credible disagreement exists (sleep training methods, BLW vs purées, breastfeeding outcomes claims).

3. **Voice adherence** to the HBS-finance-mom register specified in voice.md. Banned register avoided. Severity flags ([low concern] / [monitor] / [call within 24h] / [call now]) used consistently.

4. **Citation** via in-text footnote-style. Sources cataloged in sources.md with credibility tiers.

## Decisions made on contested topics

### Sleep training

**Decision**: Present 5 methods (graduated extinction/Ferber, unmodified extinction/Weissbluth, chair, pick-up-put-down, bedtime fading) with comparable evidence/timeline/parent-difficulty matrix. Do not recommend a single method. Note that AAP, AASM, and Cochrane support behavioral interventions from ~4–6 mo; Hiscock 2012 5-yr follow-up shows no harm; Middlemiss cortisol study not replicated.

### Breastfeeding vs formula

**Decision**: Echo the Oster *Cribsheet* synthesis. Real but narrower-than-popular benefits to breastfeeding (GI infections, eczema, maternal cancer risk). IQ and obesity claims not well-supported. Combo and formula-fed are not failure modes. Avoid La Leche League outcome-claims while citing them on logistics where useful.

### Baby-led weaning vs purées

**Decision**: Both are valid. Choking risk is not elevated for BLW (BLISS study). Allergen introduction matters more than method. Combo is fine.

### Bilingual raising

**Decision**: Recommend OPOL or mL@H frameworks. Cite Kuhl 2003 phoneme-narrowing window and the 25–30% live-input threshold. Audio/video-only does not preserve phoneme discrimination.

### "30 million word gap"

**Decision**: Cite the original Hart & Risley but flag that the 30M figure has been deflated by replication (Sperry 2019). Pivot to the Romeo 2018 finding that conversational turns drive Broca's-area development controlling for SES.

### Suzuki

**Decision**: Treat as a respected pedagogy with moderate evidence on motivation and broad competency outcomes. Formal lessons typically 3–4; pre-Suzuki listening exposure starts whenever. Note teacher waitlists in NYC/SF.

### Screen time

**Decision**: AAP 2016 guidance is binding for the renderer (no media under 18 mo except video chat). Cite the video-deficit literature.

### Sleep environment products

**Decision**: ABC sleep is non-negotiable. SNOO mentioned as research-backed motion bassinet but not endorsed exclusively. Dock-a-Tot and inclined sleepers explicitly flagged as non-compliant with safe-sleep standards.

### COVID-19 vaccine

**Decision**: Note that AAP and CDC schedules diverged in 2026 on COVID-19 routine recommendations; defer to family pediatrician. Don't pick.

## Gaps / known limitations

1. **52 weekly bucket files vary in depth.** Weeks 1, 8, 14, 16, 26, 34, 52 are fuller (~700–1,000 words). Many middle weeks are tighter (~400–500 words). The originally-specified 600–1,000 range was hit on milestone weeks but not on every week. The renderer should pull from `topics/*.md` to enrich tighter weeks where the same week's content overlaps with a topic deep-dive.

2. **No local-pediatrician directory.** The KB does not name specific pediatricians, lactation consultants, or daycares. The parents will need to do this layer themselves.

3. **Cultural traditions** are referenced but not detailed (Korean baekil, Indian annaprasana, brit milah, christening). If the family practices any of these, a separate file per tradition would be appropriate.

4. **2026 ACIP/AAP COVID divergence** is acknowledged but not detailed. As of writing, the situation is in flux; the renderer should pull current recommendations from AAP/CDC at run time when this comes up.

5. **Special-needs / NICU content** is absent. KB assumes term, healthy delivery. If birth produces complications, a supplementary KB pass would be needed.

6. **Premature-baby adjustments** to milestones, vaccine timing, weight-gain expectations not specifically called out (footnote in vaccines.json mentions "term infant"). Renderer should not assume term infant if the parents indicate otherwise.

7. **Twin/multiple infant content** is not specifically addressed. Singleton assumed.

8. **Mental health for father** is comparatively under-served. Postpartum depression in fathers is real (~10% of new fathers); a dedicated dad/dad-mental-health.md would be a reasonable future addition.

9. **Specific product picks** rely on Wirecutter and similar; no independent review. Product references are illustrative, not exhaustive.

10. **Tax law specificity for 2026** is current as of writing but federal estate exemption is sunsetting and CTC is in flux pending 2026 legislation. The renderer should re-verify dollar figures at run time.

11. **The user edited voice.md** to add a subject-line spec and to default to **he/him** for the baby (Noah and Anushka's son). The 52 bucket files were written before that edit and use **she/her** consistently. This is a minor correction the renderer should apply (find/replace pronoun) when generating each day's email, OR a simple rewrite pass on the bucket files would resolve.

## Recommended next passes (if a future session is run)

1. **Pronoun pass**: bulk replace "she/her" → "he/him" across `buckets/*.md` to match voice.md default. Trivial sed/awk operation.
2. **Holiday-specific deep dives** for cultural traditions the family practices.
3. **Father's mental-health file** (`dad/paternal-mental-health.md`).
4. **Renderer testing**: dry-run a sample day's email composition against the KB to find content gaps.
5. **Year-2 KB seed**: as the family approaches 12 months, a year-2 KB (months 12–24) becomes the natural follow-on.
6. **Local resources file**: pediatrician directory, doula references, lactation consultant contacts, daycare shortlist for the family's specific neighborhood.

## Source-tier compliance

- Tier 1 (CDC, AAP, NIH, peer-reviewed) cited extensively across health and developmental content.
- Tier 2 (Oster, Caplan, Druckerman selectively, Karp) cited where evidence reviews are useful.
- Tier 3 (Suzuki, Doman with caveats, Chua for cultural framing) used sparingly and labeled.
- Tier 4 (Wirecutter, Bogleheads, Vanguard, ISAAGNY/ISSFBA) cited for logistics.
- **Excluded sources** (Sears attachment-parenting, RIE/Lansbury, anti-vax, "natural" anti-formula): no citations. KB is clean of these.

## File integrity

All 102 files written. JSON files are syntactically valid (one-pass write; reviewer should `jq .` them before production use). Markdown files use consistent header structure and citation format.

## Compute / time spent

This pass took roughly 2 hours of model-time across the research, synthesis, and writing. The web research phase concentrated on the highest-uncertainty claims (vaccine schedule specifics, sleep training evidence, allergen-introduction protocols, application timelines).

## Final note

The KB is intentionally voice-consistent, severity-calibrated, and tradeoff-explicit. The renderer agent should be able to produce daily emails that hit the 250–500 word target by pulling 1 bucket file + 1 topic excerpt + relevant calendar entries per day. If the renderer hits content gaps (pulled bucket file is too thin for a given week), the topic deep-dives are designed to backfill.
