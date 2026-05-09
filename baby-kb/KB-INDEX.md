# Baby KB — Source-of-Truth for Daily Email Renderer

This directory is the source-of-truth knowledge base for a daily email agent that helps two new parents navigate year one (first child, due 2026-05-11). The renderer agent at 7am PT pulls from these files, composes the day's email, and sends.

## Audience and voice constraints
- **Parents**: dual high-achievers, lean tiger-mom, Bay Area / NYC pipeline plausible. They want data, citations, severity calibration, and outcome-oriented framing.
- **Tone**: HBS finance mom — data-dense, warm, reassuring, executive-summary structure. No saccharine register, no crunchy/RIE/attachment-parenting framing, no woke-load language.
- **See `voice.md` for the binding tone guide.**

## Layout

```
README.md            ← this file
voice.md             ← tone guide (binding for renderer)
sources.md           ← whitelist of cited sources with credibility tier
RESEARCH-LOG.md      ← what was produced, what's still gap

buckets/
  week-01.md … week-52.md       ← week-by-week guidance, year 1
                                   week 01 == week of birth (so week 01 starts ~2026-05-11)

topics/
  sleep-newborn-fundamentals.md
  sleep-4-month-regression.md
  sleep-training-methods.md     ← multi-method comparison, no single recommendation
  naps-by-age.md
  night-weaning.md
  breastfeeding-vs-formula-vs-combo.md
  pumping-and-storage.md
  introducing-solids.md         ← BLW vs purée + allergen protocol
  weaning-from-breast-or-bottle.md
  nutrition-year-one.md
  language-exposure.md
  bilingual-and-trilingual-raising.md
  music-and-suzuki.md
  reading-aloud.md
  tummy-time-and-motor.md
  screen-time.md
  vaccines-overview.md
  fever-by-age.md
  common-illnesses-year-one.md
  car-seat-and-safety.md
  baby-proofing-timeline.md
  choking-hazards.md
  when-to-go-to-er.md
  nanny-vs-daycare-vs-au-pair.md
  finding-and-vetting-care.md
  daycare-illness-realities.md
  first-birthday-planning.md
  photography-milestones.md
  holidays-with-baby.md
  travel-with-infant.md
  meeting-grandparents-and-extended-family.md

calendars/
  vaccines.json                 ← AAP/CDC schedule, year 1, machine-readable
  well-visits.json              ← AAP Bright Futures periodicity schedule
  enrichment-windows.json       ← critical-period windows w/ evidence flags

dad/
  finances-529.md
  life-insurance.md
  estate-guardianship.md
  paternity-leave-optimization.md
  family-budget-year-one.md
  activity-pipeline.md          ← waitlist timing for top NY/SF programs

mom/
  postpartum-physical-recovery.md
  ppd-watch-fors.md
  breastfeeding-logistics.md
  return-to-work.md

schools/
  preschool-application-timeline.md
  elementary-prep.md
  extracurriculars-by-age.md
```

## How the renderer should use this

Each daily email follows the structure in `voice.md`. To compose:

1. Compute baby's age in weeks. Pull `buckets/week-NN.md` for primary content.
2. Pull `calendars/*.json` for next 14 days of upcoming events (vaccines, well-visits, enrichment-window opens).
3. If the week's content references a topic deep-dive, pull from `topics/<topic>.md` for the source paragraph. Don't dump the whole topic file into the email.
4. On Fridays, rotate in a piece from `dad/` or `mom/` (alternate weekly).
5. Always cite. The "Source note" footer in each email pulls from the inline citations of the file used.

## Conventions

- **Citations**: footnote-style `[1]` with sources block at file bottom. Each source maps to an entry in `sources.md`.
- **Unverified claims**: marked `[unverified]`. Renderer should skip these.
- **Severity flags** on health content use exactly four levels:
  - `[low concern]` — common, no action needed
  - `[monitor]` — watch and document
  - `[call within 24h]` — pediatrician within a day
  - `[call now]` — same-day call or 911/ER
- **Disagreement**: where credible sources disagree (sleep training, BLW vs purée), present 2–4 perspectives with evidence-quality flags. Do not pick.
- **Dates in week files** are computed off DOB 2026-05-11. Week 01 = days 0–6. Week 52 = days 357–363. First birthday on roughly day 365.

## What's intentionally not here

- Birth/labor content (the parents have OB-GYN/doula).
- Genetic/clinical decision-making (defer to pediatrician).
- Anti-vax, attachment-parenting, "natural" anti-formula content (see `voice.md`).
