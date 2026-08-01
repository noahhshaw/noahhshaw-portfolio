# Weekly Newsletter Authoring Guide — weeks 13–52 (binding)

You are authoring Saturday-morning weekly emails for Avi (he/him, born 2026-05-11; day N = N days old; week = floor(N/7)+1). Parents: Noah (father) and Anoushka (mother — NEVER "Anushka", hard validator error). Audience: dual high-achiever SF parents; voice = data-dense, warm, executive-summary; lead with what matters, quantify, cite, calibrate. Read `baby-kb/voice.md` for the full register — the weekly-era section is binding.

## Output shape

Write a JSON array of WeeklyDef objects to your assigned `scripts/data/weeks-<loWeek>-<hiWeek>.json`:

```json
{
  "ageInDays": 89,
  "subject": "Week 13: ...",
  "citations": ["baby-kb/voice.md", "baby-kb/buckets/week-13.md", "..."],
  "content": {
    "ageInDays": 89,
    "week": 13,
    "hook": "...",
    "thisWeek": "...",
    "watchFors": ["[low concern] ...", "..."],
    "enrichment": [{"body": "...", "sourceLabel": "...", "sourceUrl": "..."}],
    "upcoming": ["Day 112-126 (Aug 31–Sep 14, 2026): ..."]
  }
}
```

## Hard rules (mechanically validated — violations bounce the batch)

- subject: exactly `Week N: <hook>`; ≤72 chars; no emoji, no `!`, no quotes. Hook = the single most decision-relevant item that week.
- content.ageInDays == ageInDays == the assigned Saturday; content.week == floor(ageInDays/7)+1.
- thisWeek: 2–3 sentences — what develops across days N..N+6, from that week's bucket (`baby-kb/buckets/week-NN.md`). The buckets were just corrected to CDC-2022 75th-percentile framing — PRESERVE the hedges ("emerging for some", "CDC checkpoint: X months"). Never present early attainment as expected.
- watchFors: 4–5 lines, each starting with exactly one tag: `[low concern]` / `[monitor]` / `[call within 24h]` / `[call now]`. EXACTLY ONE `[call now]` line per email; the only `!` allowed in the whole email lives inside it. Pull content from the week's bucket; vary lines week to week — never copy the previous week's set. Baseline `[call now]` for infants ≥3 months: fever thresholds per bucket guidance, labored breathing, blue lips/unresponsiveness → 911.
- enrichment: 3–5 bullets, each starting with an imperative verb, spanning ≥3 domains, MIXING at-home practice with pipeline moves (enrollments/waitlists with lead times) in the one section. Attach sourceLabel+sourceUrl (from the palette below) when a bullet rests on a specific claim, program, or deadline. SF Bay Area ONLY — never NYC.
- upcoming: 2–4 dated lines. Use the exact day-windows + calendar dates from `scripts/data/weekly-context-map.json` (precomputed — do NOT do your own date math). Medical scheduling lives here as dated entries ("Day 112–126 (Aug 31–Sep 14, 2026): 4-month well visit — book it"). There is NO Action items section.
- citations: 2–4 entries, exact real paths: always `baby-kb/voice.md` + the week's bucket; add the most relevant of `baby-kb/topics/enrichment-maximalist-sf.md`, other topics/, `baby-kb/calendars/enrichment-pipeline-calendar.json`, mom/, dad/ files. Never cite a file you didn't use. NEVER put a `baby-kb/` path in any body text.
- Length: 250–600 words total prose (target 350–500 — less is more). No emoji anywhere. Numbers: digits ≥10, spelled <10, except measurements ("6 oz", "100.4F rectal"). Temperatures always note the route.
- Banned (validator-enforced or voice-banned): snuggle, precious, "little one", "wee one", blessing, miracle, "mama bear", village, "trust your instincts", "every baby is different", "self-care", magical, "sweet baby", "birthing person", chestfeeding, journey/adventure-as-parenting, attune/attunement, co-regulate, "honor the child's experience".
- Do NOT author the milestone check-in — appended mechanically later.

## Content sources (read them)

1. `baby-kb/buckets/week-NN.md` for each assigned week — the primary source for thisWeek + watchFors.
2. `scripts/data/weekly-context-map.json` — your per-Saturday facts: calendar date, active pipeline moves, visit windows with real dates.
3. `baby-kb/calendars/enrichment-pipeline-calendar.json` — the 14 dated pipeline moves: programs, costs, lead times, evidence grades. A move belongs in the week where its window OPENS or its deadline nears — not every week it is merely active.
4. `baby-kb/topics/enrichment-maximalist-sf.md` — program details, costs, and the honest evidence calibration. When evidence is low, SAY so in one clause ("no dose-response evidence under 12 months — one class is plenty").
5. Other topics as relevant: introducing-solids.md (weeks ~22–28), sleep-4-month-regression.md (weeks ~15–20), naps-by-age.md, baby-proofing-timeline.md (mobility weeks), travel-with-infant.md, reading-aloud.md, music-and-suzuki.md, language-exposure.md.

## URL palette (inline sources — use these EXACT urls, never invent one)

Authority:
- https://www.cdc.gov/act-early/milestones/4-months.html | 6-months.html | 9-months.html | 1-year.html | 15-months.html
- https://www.healthychildren.org/English/ages-stages/baby/Pages/Developmental-Milestones-7-Months.aspx
- https://www.healthychildren.org/English/ages-stages/baby/Pages/Developmental-Milestones-12-Months.aspx
- https://www.healthychildren.org/English/ages-stages/baby/Pages/Movement-4-to-7-Months.aspx
- https://www.healthychildren.org/English/ages-stages/baby/Pages/Movement-8-to-12-Months.aspx
- https://www.healthychildren.org/English/ages-stages/baby/sleep/Pages/Back-to-Sleep-Tummy-to-Play.aspx
- https://www.healthychildren.org/English/ages-stages/baby/sleep/Pages/default.aspx
- https://www.healthychildren.org/English/ages-stages/baby/sleep/Pages/Getting-Your-Baby-to-Sleep.aspx
- https://www.healthychildren.org/English/ages-stages/baby/feeding-nutrition/Pages/Starting-Solid-Foods.aspx
- https://www.healthychildren.org/English/safety-prevention/at-home/Pages/Childproofing-Your-Home.aspx
- https://www.healthychildren.org/English/safety-prevention/at-play/Pages/Swim-Lessons.aspx
- https://www.healthychildren.org/English/health-issues/conditions/fever/Pages/default.aspx
- https://www.healthychildren.org/English/healthy-living/nutrition/Pages/Vitamin-D-On-the-Double.aspx
- https://www.aap.org/en/practice-management/care-delivery-approaches/periodicity-schedule/
- https://www.aap.org/en/patient-care/immunizations/aap-policy-on-immunizations/
- https://www.aap.org/en/patient-care/early-childhood/early-literacy/
- https://pubmed.ncbi.nlm.nih.gov/29442613/ (Romeo et al. 2018, conversational turns)
- https://pubmed.ncbi.nlm.nih.gov/22490184/ (Gerry/Unrau/Trainor 2012, active music)
- https://reachoutandread.org/ | https://www.postpartum.net/

Programs (verified live):
- https://www.swimlpb.com/ | https://www.swimlpb.com/swim-classes/tuition | https://www.jccsf.org/program/swim-school/ | https://www.infantswim.com/
- https://www.sfmusictogether.com/infants.html | https://www.sfmusictogether.com/Prices.html | https://sfcm.edu/study/pre-college/early-childhood | https://suzukiassociation.org/
- https://svndl.stanford.edu/participate/ | https://babylab.berkeley.edu/get-involved | https://langcog.stanford.edu/parents | https://kidsdevelopment.ucsf.edu/faqs
- https://www.starbridgemandarinimmersion.com/ | https://www.lacademyschools.com/locations/san-francisco-preschool-nob-hill | https://www.care.com/chinese-speaking-nannies/san-francisco-ca
- https://sfpl.org/kids/kids/events/storytime-sfpl | https://smcl.org/blogs/post/1000-books-before-kindergarten/
- https://www.cosmosmontessorisf.com/program-3 | https://recesscollective.org/ | https://www.issfba.org/admission-process/
- https://www.calacademy.org/ | https://www.hanen.org/information-tips/does-baby-sign-make-a-difference

## Diversity mandate

- No week may reuse the previous or next week's enrichment set; rotate domains (motor, language, music, sensory-outdoor, reading, sleep-routine, social, water, planning).
- Each pipeline move appears in FULL detail once (in its opening/deadline week) and at most once more as a one-line reminder near its expiry. Do not re-pitch the same program weekly.
- Subjects must all differ; consecutive hooks must not repeat a theme.
- Developmental arc: track the corrected buckets — 4-month regression (weeks ~15–19), rolling + solids-readiness research (~20–24), solids start + sitting practice (~26–30), object permanence/babble/baby-proofing (~30–36), pulling-to-stand/cruising + finger foods (~36–44), first-words environment + first steps + birthday/preschool-list horizon (~44–52).
