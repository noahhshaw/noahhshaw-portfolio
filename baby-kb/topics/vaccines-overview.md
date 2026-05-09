# Vaccines — Year-One Overview

This file is a companion to `calendars/vaccines.json` (the machine-readable schedule). For each year-1 vaccine: what it prevents, how it works, common reactions, severity thresholds for concern.

## The schedule (high-level, year 1)

- **Birth**: HepB #1, vitamin K injection, erythromycin eye ointment.
- **2 months**: HepB #2, RV #1, DTaP #1, Hib #1, PCV #1, IPV #1.
- **4 months**: RV #2, DTaP #2, Hib #2, PCV #2, IPV #2.
- **6 months**: RV #3 (RV5 only), DTaP #3, Hib #3 (PRP-T only), PCV #3, HepB #3 (6–18 mo), IPV #3 (6–18 mo), Influenza #1 (annual, seasonal).
- **9 months**: Influenza #2 if first season; otherwise no scheduled vaccines.
- **12 months**: MMR #1, VAR #1, HepA #1, PCV #4, Hib booster.
- **RSV**: nirsevimab (or maternal RSVpreF in pregnancy) covers first RSV season.

For exact ages, dose intervals, product formulations, and conditional doses, see `calendars/vaccines.json`.

## The vaccines, one by one

### HepB (Hepatitis B)
- **Prevents**: chronic Hep B infection (which can lead to cirrhosis, liver cancer in adulthood).
- **Why birth**: maternal-to-infant transmission risk. Not optional even if mother tests negative — protects against household exposure throughout childhood.
- **Reactions**: soreness, low-grade fever (low concern). Anaphylaxis extremely rare.

### RV (Rotavirus, oral)
- **Prevents**: rotavirus gastroenteritis (severe diarrhea, dehydration; pre-vaccine, leading cause of childhood hospitalization in US).
- **Two products**: RotaTeq (RV5, 3 doses) or Rotarix (RV1, 2 doses). Pediatrician's choice.
- **Reactions**: mild diarrhea, fussiness. Rare risk: intussusception (1 in 20,000 to 1 in 100,000) — bowel obstruction; signs are bloody currant-jelly stool, episodic severe crying with knee-drawing, vomiting. Call same-day if these signs.
- **First dose must be given by 14 weeks 6 days**; series complete by 8 mo 0 days.

### DTaP (Diphtheria, Tetanus, acellular Pertussis)
- **Prevents**: diphtheria (rare in US but lethal), tetanus (lockjaw), pertussis ("whooping cough" — most lethal vaccine-preventable disease for unvaccinated infants).
- **Reactions**: fever, soreness, fussiness, drowsiness 24–48h post-vaccine. Hard injection-site swelling possible.
- **Watch-fors**: persistent crying >3h post-vaccine, fever >104°F, hypotonic-hyporesponsive episode → call within 24h.

### Hib (Haemophilus influenzae type b)
- **Prevents**: Hib meningitis, epiglottitis, septic arthritis.
- **Reactions**: minimal — mild fever or soreness.

### PCV (Pneumococcal Conjugate, PCV15 or PCV20)
- **Prevents**: invasive pneumococcal disease (meningitis, sepsis, severe pneumonia), some otitis media.
- **PCV20 is approved for the full series** as of 2024 ACIP; covers more serotypes than PCV15.
- **Reactions**: fever, soreness, fussiness.

### IPV (Inactivated Poliovirus)
- **Prevents**: polio.
- **Reactions**: minimal — mild local soreness.

### Influenza (annual, starts at 6 mo)
- **Prevents**: seasonal flu. Two doses 4 weeks apart in first flu season; one annually thereafter.
- **Reactions**: low-grade fever, soreness.

### RSV (nirsevimab or maternal RSVpreF)
- **Prevents**: severe RSV bronchiolitis (peak hospitalization age 0–6 mo).
- **Two paths**:
  - Maternal RSVpreF vaccine (Abrysvo) at 32–36 weeks gestation in seasonal window — protects baby for first ~6 months via passive antibody transfer.
  - Infant nirsevimab (Beyfortus) IM injection in first RSV season if maternal vaccination not received.
- **Reactions**: minimal — mild local rash, fussiness.

### MMR (Measles, Mumps, Rubella) — at 12 mo
- **Prevents**: measles (resurgent in US 2024–2026 in unvaccinated communities), mumps, rubella.
- **Live attenuated vaccine** — mild rash and fever 7–12 days post-vaccine common, not contagious.
- **Watch-fors**: persistent high fever, rash with respiratory distress (rare).
- **Note**: Wakefield-era autism-link claims have been thoroughly debunked. No association.

### VAR (Varicella) — at 12 mo
- **Prevents**: chickenpox and its rare-but-dangerous complications (encephalitis, secondary bacterial infections).
- **Live attenuated** — mild rash possible.

### HepA (Hepatitis A) — at 12 mo
- **Prevents**: Hep A (uncommon in US but elevated in international travel and food-borne outbreaks).
- **Reactions**: minimal.

## Severity thresholds for vaccine reactions (general)

- `[low concern]` Local redness <2 inches, soreness, fussiness 24–48h, low-grade fever ≤101°F.
- `[monitor]` Fever 101–102°F lasting >48h; persistent fussiness >48h; hard swelling 2–4 inches.
- `[call within 24h]` Fever >104°F; persistent inconsolable crying >3h; hypotonic-hyporesponsive episode (limp, pale, unresponsive); injection-site swelling extending past joint.
- `[call now]` Anaphylaxis (facial swelling, breathing difficulty, hives + vomiting) within 30 min — call 911. Seizure activity. Encephalopathy signs.

**Important**: in infants <90 days, ANY fever ≥100.4°F rectal — even immediately post-vaccine — requires same-day evaluation per AAP febrile-infant guideline. Pediatrician will not assume vaccine-related until other causes ruled out[1].

## Acetaminophen and antibody response

Prophylactic acetaminophen *before* vaccines reduces post-vaccine antibody response (Prymula et al., Lancet 2009)[2]. Treat fever after, not before. Acetaminophen weight-based dosing per pediatrician.

## Avoiding misinformation

The AAP and CDC schedules are aligned in 2026 except on a few items (notably COVID-19 routine recommendations and a few cadence specifics). Any "alternative schedule" advocated by anti-vax sources delays protection without benefit and is not endorsed by any major pediatric or public-health body.

## Sources

[1] AAP Clinical Practice Guideline, "Evaluation and Management of Well-Appearing Febrile Infants 8–60 Days Old," Pediatrics 2021.
[2] Prymula R et al., "Effect of prophylactic paracetamol administration at time of vaccination on febrile reactions and antibody responses in children," Lancet 2009; 374(9698):1339-1350.
- CDC Child and Adolescent Immunization Schedule, 2026.
- AAP 2026 Immunization Schedule, Pediatrics policy statement.
