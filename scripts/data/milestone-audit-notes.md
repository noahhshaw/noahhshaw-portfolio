# Milestone Catalog Audit — 2026-08-01

Audit of `baby-kb/milestones/aap-cdc-2022.json` (107 entries) against CDC "Learn the Signs. Act Early." 2022 checklists (4, 6, 9, 12, 15 months — all five pages loaded and read in full) and AAP HealthyChildren.org milestone/stage pages (3-, 7-, 12-month milestone pages plus Movement 4-7 mo, Movement 8-12 mo, Emotional & Social 8-12 mo, Language 8-12 mo — all fetched successfully). Scope: ages 3-12 months (days 85-365).

## Coverage map (days 85-365)

Every category has at least one active entry across the entire 85-365 range — no dead zones. Density by category:

| Category | 85-150 | 150-240 | 240-365 | Notes |
|---|---|---|---|---|
| social-emotional | 4 active | 5 active | 10 active | Densest category; no holes |
| language-communication | 4 active | 7 active | 12 active | Saturated; no holes |
| cognitive | 3 active (thinnest ~90-120: only tails of 60-120 windows) | 5 active | 8 active | Thinnest stretch is ~90-120 days |
| movement-gross | 5 active | 7 active | 7 active | Continuous |
| movement-fine | 4 active | 3 active (thin ~180-210) | 7 active | Thin at ~180-210 (only tails) |

## Verification against CDC 2022 checklists

All 12 items on the 6-month, all 13 on the 9-month, and all 10 on the 1-year checklist are present in the catalog. All 13 on the 4-month checklist present. 15-month checklist: 13 of 14 present — **"Uses fingers to feed herself some food" was missing** (now added, via the HealthyChildren 12-month page which lists finger-feeding at 12 months).

Crawling: correctly absent from CDC-sourced entries (removed in the 2022 revision). The catalog's two crawling entries cite HealthyChildren, which still lists crawling — left as-is per instructions.

## Gaps added (11 entries, seed_order 108-118)

All source URLs were fetched successfully during this audit.

| Key | Category | Window (days) | Source |
|---|---|---|---|
| watches-across-the-room | cognitive | 120-210 | HC Developmental-Milestones-7-Months |
| rocks-and-kicks-on-tummy | movement-gross | 120-180 | HC Movement-4-to-7-Months |
| grabs-own-feet | movement-gross | 120-210 | HC Movement-4-to-7-Months |
| turns-and-twists-objects | movement-fine | 150-240 | HC Movement-4-to-7-Months |
| bounces-when-held-standing | movement-gross | 150-240 | HC Movement-4-to-7-Months |
| rocks-on-hands-and-knees | movement-gross | 180-300 | HC Developmental-Milestones-12-Months ("assumes hands-and-knees position") |
| catches-self-when-sitting | movement-gross | 210-300 | HC Movement-8-to-12-Months (protective arm extension) |
| shows-new-fears | social-emotional | 240-365 | HC Emotional-and-Social-Development-8-12-Months |
| tests-your-reactions | social-emotional | 240-365 | HC Developmental-Milestones-12-Months |
| feeds-self-with-fingers | movement-fine | 270-365 | HC Developmental-Milestones-12-Months (also CDC 15-month checklist) |
| squats-to-pick-up | movement-gross | 330-450 | HC Movement-8-to-12-Months |

File: `scripts/data/milestone-gap-additions.json` — exact row shape, ready to append.

## Window disagreements found

1. **`coos-makes-sounds` (35-60 days, cites CDC 2-months)** — CDC 2022 places cooing ("oooo", "aahh") on the **4-month** checklist; the 2-month item is the broader "makes sounds other than crying." The catalog's high of 60 days implies a 2-month checkpoint for cooing, which is stricter than CDC 2022. Suggest high_days 120 and source_url 4-months.html, or rename toward "makes sounds other than crying."
2. No other material disagreements. Spot-checked items CDC moved in 2022 — laughs (now 6 mo: catalog 90-180 OK), babble strings (9 mo: 180-270 OK), pincer grasp (12 mo: 240-365 OK), first words besides mama/dada (15 mo: 300-450 OK), first steps (15 mo: 300-450 OK) — all consistent.

Minor category note (not an error): `swings-at-toys` and `grabs-own-feet`-style body-play items sit in movement-gross while CDC groups all movement together; catalog's split is internally consistent.

## Week-bucket conflicts with CDC 2022 (sampled weeks; files not edited)

- **week-39 (~9 mo): "Language: 1-3 specific words"** — conflicts with CDC 2022, which deliberately moved first words to the 15-month checklist ("tries to say one or two words besides mama/dada"). Expecting specific words at 9 months contradicts the 75th-percentile framing.
- **week-44 (~10 mo): "Language: 1-5 specific words"** — same conflict, larger claim. Also "standing alone reliably" at 10 months is ahead of HealthyChildren's "stands momentarily" at 12 months.
- **week-48 (~11 mo): "1-5+ words"; "walks for many"** — same word-count conflict; walking framed as majority behavior is ahead of CDC's 15-month checkpoint.
- **week-30 (~7 mo): "pulls to stand at furniture; some cruise-step" as expected** — CDC 2022 puts pull-to-stand and cruising on the 1-year checklist; the catalog's own windows start at 240/270 days. Also "looks for fully hidden object" at 7 months (CDC: dropped-out-of-sight at 9 mo; HC 7 mo: partially hidden only).
- **week-35 (~8 mo): "pat-a-cake" listed as current social play** — CDC 1-year item; hedged elsewhere in the file but listed unqualified in milestones.
- **week-17 (~4 mo): "rolling reliably"** — CDC 2022 places rolling (tummy-to-back) at 6 months; "possible/emerging" would match, "reliably" overstates.
- **week-22 (~5 mo): "sits independently for longer stretches"** — CDC sits-without-support checkpoint is 9 months; presenting independent sitting as expected at 5 months is ahead of the 75th-percentile standard (hedging would fix it).
- weeks 13, 26, 52: consistent with CDC 2022 (26 and 52 reproduce the checklists nearly verbatim).

Pattern: buckets from week 30 onward systematically describe ~90th-percentile-early motor/language attainment as "expected." CDC 2022 intentionally shifted to 75th-percentile ("most babies do BY age X") framing; several buckets still read like pre-2022 average-age framing.

## Deliberately NOT added

- **Crawling** (any form) — removed from CDC 2022 checklists per instructions; catalog already carries HC-sourced crawl entries.
- **"Babbles chains of consonants"** (HC 7 mo) — duplicate of `babbles-strings` (180-270).
- **"Responds to own name"** (HC 7 mo) — duplicate of `looks-when-name-called`.
- **"Full color vision" / "responds to full range of colors"** — physiological maturation, not parent-observable as a discrete check item.
- **"Pays increasing attention to speech"** (HC 12 mo) — too vague to observe/check.
- **"May be fearful in some situations"** (HC 12 mo) — subsumed by the added `shows-new-fears`.
- **"Prefers regular caregiver over all others"** (HC 12 mo) — near-duplicate of `knows-familiar-people` + `shows-preferences`.
- **"Enjoys imitating people in play"** (HC 12 mo) — near-duplicate of `imitates-gestures`.
- **Mirror self-recognition (touches smudge on own nose)** (HC 8-12 mo) — HC mentions it tentatively; standard rouge-test attainment is 15-24 months, so listing it in a ≤12-month catalog would over-promise.
- **"Gestures/points toward what she wants" at 8-12 mo** (HC Language 8-12) — covered by `lifts-arms-to-be-picked-up` (180-270) and `points-to-ask` (300-450).
- **Touching genitals during diaper changes, curling toes, slapping knees** (HC Movement 4-7) — incidental behaviors, not check-worthy milestones for a parent newsletter.

## Caveats

- CDC pages block scripted fetchers (403 via WebFetch and curl); content was captured via the in-session browser. URLs confirmed live and correct as of 2026-08-01.
- The CDC 12-month page URL is `.../1-year.html` (not `12-months.html`) — the catalog already uses the correct form.
- Additions with high_days 450 (`squats-to-pick-up`) follow the existing convention of 15-month-checkpoint items (e.g. `stacks-two-objects` 330-450) and will surface within the newsletter's 3-12 month range from low_days 330.
