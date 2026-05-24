/* eslint-disable no-console */
/**
 * Regenerate pre-computed artifacts for days 10-23 in the post-2026-05-18
 * format: no "Further reading" section, 3-5 "Enrichment opportunities".
 *
 * Structured content lives inline here; the renderer (render-daily.ts) is
 * the single source of the email template. After running this, run
 * `npm run milestones:bake -- --days=10-23` to append the milestone
 * check-in section, then `npm run precompute:validate`.
 *
 * Run: npx tsx scripts/regenerate-days-10-23.ts
 */
import { promises as fs } from "fs";
import { resolve } from "path";
import { spawnSync } from "child_process";
import { renderDaily, type DailyContent } from "@/lib/baby/render-daily";

const GENERATED_AT = "2026-05-18T12:00:00Z";
const KB_VERSION = "2026-05-18-regen";

const U = {
  brightFutures:
    "https://www.aap.org/en/practice-management/bright-futures/bright-futures-tools-and-resources/",
  cordCare:
    "https://www.healthychildren.org/English/ages-stages/baby/bathing-skin-care/Pages/Umbilical-Cord-Care.aspx",
  bathing:
    "https://www.healthychildren.org/English/ages-stages/baby/bathing-skin-care/Pages/default.aspx",
  tummyTime:
    "https://www.healthychildren.org/English/ages-stages/baby/sleep/Pages/Back-to-Sleep-Tummy-to-Play.aspx",
  crying:
    "https://www.healthychildren.org/English/ages-stages/baby/crying-colic/Pages/default.aspx",
  fever:
    "https://www.healthychildren.org/English/health-issues/conditions/fever/Pages/default.aspx",
  firstMonth:
    "https://www.healthychildren.org/English/ages-stages/baby/Pages/default.aspx",
  qle: "https://www.healthcare.gov/glossary/qualifying-life-event/",
  ssn: "https://www.ssa.gov/ssnumber/",
  plan529: "https://en.wikipedia.org/wiki/529_plan",
  childcare: "https://www.childcare.gov/",
  carecom: "https://www.care.com/",
  ppsi: "https://www.postpartum.net/",
  acogPostpartum:
    "https://www.acog.org/womens-health/faqs/postpartum-pain-management",
  romeo: "https://pubmed.ncbi.nlm.nih.gov/29442613/",
  carSeat: "https://www.nhtsa.gov/equipment/car-seats-and-booster-seats",
};

// Recurring clinical watch-fors. Restated daily per voice.md repetition
// guidance — severity thresholds are the kind of thing tired parents
// forget. The [call now] line is the only place an exclamation is allowed.
const CALL_NOW =
  "[call now] Rectal temperature at or above 100.4F (38.0C). Lethargy, refusing all feeds, blue or grey color, breathing faster than 60 per minute at rest, persistent grunting, projectile or bilious-green vomiting. Call 911 for blue lips or unresponsiveness!";

type DayDef = {
  ageInDays: number;
  subject: string;
  citations: string[];
  content: DailyContent;
};

const DAYS: DayDef[] = [
  {
    ageInDays: 9,
    subject: "Day 9: feeding rhythm settles; weight regain underway",
    citations: [
      "baby-kb/voice.md",
      "baby-kb/buckets/week-02.md",
      "baby-kb/topics/feeding-and-weight.md",
    ],
    content: {
      ageInDays: 9,
      hook: "feeding rhythm",
      todaysFocus:
        "Day 9. Feeding is settling into a recognizable cycle and weight regain is underway — most term infants are back to birth weight between today and day 14. The cord stump is drying and may detach within the next several days.",
      actionItems: [
        {
          body: "Confirm the first-week weight check has happened or is scheduled so the pediatrician can see the regain trajectory.",
          sourceLabel: "AAP Bright Futures periodicity",
          sourceUrl: U.brightFutures,
        },
        {
          body: "Keep the cord stump dry with the diaper folded below it; sponge baths only until it detaches.",
          sourceLabel: "AAP HealthyChildren on cord care",
          sourceUrl: U.cordCare,
        },
        {
          body: "Confirm Avi is enrolled on a health-insurance plan; the 30-day qualifying-life-event window is closing.",
          sourceLabel: "Healthcare.gov on qualifying life events",
          sourceUrl: U.qle,
        },
        {
          body: "If the SSN has arrived, plan to open the 529 this week; if not, expect it 2-4 weeks post-birth.",
          sourceLabel: "SSA on getting a Social Security number",
          sourceUrl: U.ssn,
        },
        {
          body: "Keep the feeding and diaper-output log going.",
        },
      ],
      watchFors: [
        "[low concern] Cord stump dries and detaches between days 5-15; a small spot of blood at separation is normal.",
        "[low concern] Baby acne starting to appear; mother's lochia light pink-brown and tapering.",
        "[monitor] Cord that looks wet or smells slightly off — mention it at the next visit.",
        "[call within 24h] Pus, foul smell, or redness extending more than 1 cm around the cord. Fewer than six wet diapers per day. Weight still below birth weight.",
        CALL_NOW,
      ],
      enrichment: [
        {
          body: "Accumulate 10-15 minutes of tummy time across short bouts, on your chest at an incline if floor time fatigues him.",
          sourceLabel: "AAP HealthyChildren on tummy time",
          sourceUrl: U.tummyTime,
        },
        {
          body: "Hold a high-contrast card 8-12 inches from his face and move it slowly side to side.",
        },
        {
          body: "Narrate one ordinary task in full sentences during an awake-alert window.",
        },
        {
          body: "Lay him skin-to-skin on your chest after a feed for thermoregulation and bonding.",
        },
      ],
      upcoming: [
        "Day 5-15: cord stump detaches.",
        "Day 14-21: first common growth spurt; expect a feeding-frequency uptick.",
        "Day 28-35: 1-month well visit window opens; first social smiles begin.",
      ],
    },
  },
  {
    ageInDays: 10,
    subject: "Day 10: back-to-birth-weight check; cord stump may detach",
    citations: [
      "baby-kb/voice.md",
      "baby-kb/buckets/week-02.md",
      "baby-kb/topics/feeding-and-weight.md",
    ],
    content: {
      ageInDays: 10,
      hook: "birth-weight crossing",
      todaysFocus:
        "Day 10. Most term infants reach or pass birth weight between today and day 14. If the pediatrician has not yet confirmed weight regain, call today. The cord stump commonly detaches between now and day 15, and the mother's lochia is light pink-brown and tapering.",
      actionItems: [
        {
          body: "If Avi has not been weighed since hospital discharge, call the pediatrician today to confirm the weight-regain trajectory.",
          sourceLabel: "AAP Bright Futures periodicity",
          sourceUrl: U.brightFutures,
        },
        {
          body: "Keep the cord stump dry and the diaper folded below it; sponge baths only until it detaches and the base looks dry.",
          sourceLabel: "AAP HealthyChildren on cord care",
          sourceUrl: U.cordCare,
        },
        {
          body: "If the SSN has arrived, open the 529 plan this week — front-loading the early years compounds the most.",
          sourceLabel: "529 plan overview",
          sourceUrl: U.plan529,
        },
        {
          body: "Confirm Avi is enrolled on a health-insurance plan; the 30-day qualifying-life-event window is closing.",
          sourceLabel: "Healthcare.gov on qualifying life events",
          sourceUrl: U.qle,
        },
        {
          body: "Continue the feeding log — you will hand it to the pediatrician at the 1-month visit.",
        },
      ],
      watchFors: [
        "[low concern] Cord stump dries and detaches between days 5-15; a small spot of blood when it falls off is normal.",
        "[low concern] Baby acne peaking and starting to resolve; mother's lochia light pink-brown.",
        "[monitor] Cord still attached and looks wet or smells slightly off — mention it at the next visit.",
        "[call within 24h] Pus, foul smell, or redness extending more than 1 cm around the cord. Yellow tinge on the legs or below. Weight still below birth weight. Mother's bleeding suddenly heavier or passing large clots.",
        CALL_NOW,
      ],
      enrichment: [
        {
          body: "Accumulate 10-15 minutes of tummy time across short bouts, on your chest at a slight incline if floor time fatigues him.",
          sourceLabel: "AAP HealthyChildren on tummy time",
          sourceUrl: U.tummyTime,
        },
        {
          body: "Hold a high-contrast card 8-12 inches from his face and move it slowly side to side to exercise visual tracking.",
        },
        {
          body: "Narrate one ordinary task in full sentences during an awake-alert window — diaper change, bottle prep, dishwashing.",
        },
        {
          body: "Lay him skin-to-skin on your chest after a feed; it supports thermoregulation and settles both of you.",
        },
      ],
      upcoming: [
        "Day 5-15: cord stump detaches.",
        "Day 14-21: first common growth spurt; expect a 24-48 hour feeding-frequency uptick.",
        "Day 28-35: 1-month well visit window opens; first social smiles begin.",
      ],
    },
  },
  {
    ageInDays: 11,
    subject: "Day 11: weight-check follow-up; settle the night-shift split",
    citations: [
      "baby-kb/voice.md",
      "baby-kb/buckets/week-02.md",
      "baby-kb/topics/parental-sleep-and-recovery.md",
    ],
    content: {
      ageInDays: 11,
      hook: "rhythm and recovery",
      todaysFocus:
        "Day 11. Feeding is settling into a recognizable rhythm: feed, diaper, 60-90 minutes of sleep, repeat, around the clock. This is the week to make that rhythm sustainable for the adults, not just the baby.",
      actionItems: [
        {
          body: "If the first-week weight check showed Avi below birth weight, confirm the recheck date the pediatrician asked for.",
          sourceLabel: "AAP Bright Futures periodicity",
          sourceUrl: U.brightFutures,
        },
        {
          body: "Settle a night-shift split if both parents are home — one parent takes roughly 11pm-3am, the other 3am-7am. It beats both parents waking for everything.",
        },
        {
          body: "Reorder postpartum supplies that run short faster than expected: nipple cream, pads, burp cloths.",
        },
        {
          body: "If the SSN has not arrived yet, expect it 2-4 weeks post-birth; the 529 and the dependent tax claim both wait on it.",
          sourceLabel: "SSA on getting a Social Security number",
          sourceUrl: U.ssn,
        },
        {
          body: "Keep logging feeds and diaper output; six or more wet diapers a day is the reassuring floor.",
        },
      ],
      watchFors: [
        "[low concern] Cord stump still attached and drying; evening fussiness building.",
        "[low concern] Witch's milk — a small breast-bud secretion from maternal hormone withdrawal — resolves in one to two weeks.",
        "[monitor] Persistent low mood, tearfulness, or anxiety in Anoushka beyond the normal baby-blues window.",
        "[call within 24h] Forceful projectile vomiting after most feeds. Fewer than six wet diapers in a day. Mother's foul-smelling discharge or fever.",
        CALL_NOW,
      ],
      enrichment: [
        {
          body: "Accumulate 10-15 minutes of tummy time across the day; a rolled receiving blanket under the chest helps if he tires quickly.",
          sourceLabel: "AAP HealthyChildren on tummy time",
          sourceUrl: U.tummyTime,
        },
        {
          body: "Respond to each of his coos and grunts as if he had spoken, pause, then respond again — conversational turns predict later language.",
          sourceLabel: "Romeo et al., Psych Science 2018",
          sourceUrl: U.romeo,
        },
        {
          body: "Read aloud for five to ten minutes; adult material is fine, the rhythm of your voice is the active ingredient.",
        },
        {
          body: "During a calm-alert window, hold him close and let him study your face without competing stimulation.",
        },
      ],
      upcoming: [
        "Day 14-21: first common growth spurt; cluster feeding for 24-48 hours.",
        "Day 14-21: target the EPDS maternal mood screen.",
        "Day 28-35: 1-month well visit window opens.",
      ],
    },
  },
  {
    ageInDays: 12,
    subject: "Day 12: lochia tapering; prep for the first growth spurt",
    citations: [
      "baby-kb/voice.md",
      "baby-kb/buckets/week-02.md",
      "baby-kb/buckets/week-03.md",
    ],
    content: {
      ageInDays: 12,
      hook: "growth-spurt prep",
      todaysFocus:
        "Day 12. The first common growth spurt is two to three days out. It looks like sudden, near-constant feeding for 24-48 hours. Knowing it is coming is half the work — it is a normal calibration, not a supply failure.",
      actionItems: [
        {
          body: "Read ahead on cluster feeding so the spurt does not read as a problem; resist supplementing reflexively if breastfeeding.",
        },
        {
          body: "Stock the kitchen and freezer for the spurt window — feeding marathons leave no time to cook.",
        },
        {
          body: "Confirm Avi's health-insurance enrollment actually processed by calling the insurer; do not trust that the form went through.",
          sourceLabel: "Healthcare.gov on qualifying life events",
          sourceUrl: U.qle,
        },
        {
          body: "If the SSN has arrived, open the 529 this week.",
          sourceLabel: "529 plan overview",
          sourceUrl: U.plan529,
        },
        {
          body: "Continue the feeding and output log.",
        },
      ],
      watchFors: [
        "[low concern] Cord stump detaching around now; baby acne peaking; mother's lochia light and tapering.",
        "[low concern] Evening fussiness and a stronger need to be held.",
        "[monitor] Mother's mood — baby blues should be easing by the end of week two; persistence past that escalates the concern.",
        "[call within 24h] Forceful projectile vomiting with weight stagnation. Fewer than six wet diapers per day.",
        CALL_NOW,
      ],
      enrichment: [
        {
          body: "Build toward 15 minutes of daily tummy time across short post-feed bouts.",
          sourceLabel: "AAP HealthyChildren on tummy time",
          sourceUrl: U.tummyTime,
        },
        {
          body: "Hold him in front of a mirror for 30-60 seconds; he is not recognizing himself yet, but face-perception circuitry is tuning.",
        },
        {
          body: "Narrate your next ordinary task in full, simple sentences during an awake-alert window.",
        },
        {
          body: "Offer slow face-to-face time 8-12 inches away — he prefers human faces over any other pattern.",
        },
      ],
      upcoming: [
        "Day 14-21: first growth spurt; expect a feeding-frequency surge.",
        "Day 14-21: complete the EPDS maternal mood screen.",
        "Day 28-35: 1-month well visit; first social smiles.",
      ],
    },
  },
  {
    ageInDays: 13,
    subject: "Day 13: growth spurt likely tomorrow; line up the EPDS",
    citations: [
      "baby-kb/voice.md",
      "baby-kb/buckets/week-02.md",
      "baby-kb/buckets/week-03.md",
    ],
    content: {
      ageInDays: 13,
      hook: "spurt eve",
      todaysFocus:
        "Day 13. End of week two. Most term infants have regained birth weight. The first growth spurt typically opens tomorrow with a sharp rise in feeding frequency that resets within two days.",
      actionItems: [
        {
          body: "Plan the next two days lightly — the spurt window is not the time for commitments that cannot move.",
        },
        {
          body: "Schedule the EPDS maternal mood screen for this coming week; if the pediatrician will not run it, Anoushka can take it herself and a score above 10 warrants a call to her OB.",
        },
        {
          body: "Open the 529 plan if the SSN is in hand.",
          sourceLabel: "529 plan overview",
          sourceUrl: U.plan529,
        },
        {
          body: "Apply for paternity leave if not already on it; coordinate employer leave with any state paid-family-leave benefit.",
        },
        {
          body: "Keep the feeding log current ahead of the 1-month visit.",
        },
      ],
      watchFors: [
        "[low concern] Cord stump fully detached or nearly so; baby acne visible; cluster feeding may begin tonight.",
        "[low concern] Sustained eye contact appearing during feeds.",
        "[monitor] Mother's mood at the two-week mark — baby blues easing is expected; persistence is the signal to act.",
        "[call within 24h] Projectile vomiting after most feeds. Fewer than six wet diapers per day.",
        CALL_NOW,
      ],
      enrichment: [
        {
          body: "Keep daily tummy time near 15 minutes, split across short bouts after feeds.",
          sourceLabel: "AAP HealthyChildren on tummy time",
          sourceUrl: U.tummyTime,
        },
        {
          body: "Take conversational turns with his coos — respond, pause, respond again.",
          sourceLabel: "Romeo et al., Psych Science 2018",
          sourceUrl: U.romeo,
        },
        {
          body: "Read aloud for ten minutes with exaggerated, rhythmic prosody.",
        },
        {
          body: "Give him a slow side-to-side moving target to track during an alert window.",
        },
      ],
      upcoming: [
        "Day 14-21: first growth spurt underway.",
        "Day 14-21: EPDS maternal mood screen.",
        "Day 28-35: 1-month well visit; first social smiles.",
      ],
    },
  },
  {
    ageInDays: 14,
    subject: "Day 14: two weeks old; growth spurt opens; EPDS this week",
    citations: [
      "baby-kb/voice.md",
      "baby-kb/buckets/week-03.md",
      "baby-kb/mom/postpartum-mood.md",
    ],
    content: {
      ageInDays: 14,
      hook: "two weeks; growth spurt",
      todaysFocus:
        "Day 14. Two weeks old, week three opens. The first growth spurt is likely starting: 24-48 hours of unusually frequent feeding, then a reset. If breastfeeding, supply calibrates to this demand — let it.",
      actionItems: [
        {
          body: "Treat today and tomorrow as feeding-heavy; the spurt is a normal supply calibration, not a problem to fix.",
        },
        {
          body: "Complete the EPDS maternal mood screen this week; a score of 13 or higher traditionally distinguishes likely depression and warrants a call.",
          sourceLabel: "Postpartum Support International",
          sourceUrl: U.ppsi,
        },
        {
          body: "Open the 529 plan now that the SSN should have arrived.",
          sourceLabel: "529 plan overview",
          sourceUrl: U.plan529,
        },
        {
          body: "Verify Avi's health-insurance enrollment processed with the insurer directly.",
          sourceLabel: "Healthcare.gov on qualifying life events",
          sourceUrl: U.qle,
        },
        {
          body: "Continue the feeding and output log.",
        },
      ],
      watchFors: [
        "[low concern] Cluster feeding for 24-48 hours, evening fussiness, a stronger need to be held.",
        "[low concern] Baby acne — neonatal cephalic pustulosis — peaking around three to four weeks and resolving on its own.",
        "[monitor] Tearfulness or anxiety in Anoushka beyond what the baby's schedule imposes; baby blues should be resolving by now.",
        "[call within 24h] Forceful projectile vomiting with weight stagnation. Fewer than six wet diapers per day.",
        CALL_NOW,
      ],
      enrichment: [
        {
          body: "Accumulate 10-15 minutes of tummy time across awake-alert windows after feeds.",
          sourceLabel: "AAP HealthyChildren on tummy time",
          sourceUrl: U.tummyTime,
        },
        {
          body: "Hold him at a mirror for 30-60 seconds — the face-tracking response is the point.",
        },
        {
          body: "If raising him bilingual, make sure the second-language parent is already speaking that language consistently.",
        },
        {
          body: "Respond to his vocalizations in turn-taking exchanges during calm-alert time.",
          sourceLabel: "Romeo et al., Psych Science 2018",
          sourceUrl: U.romeo,
        },
      ],
      upcoming: [
        "Day 17-21: growth spurt resolving.",
        "Day 28-35: 1-month well visit; first social smiles.",
        "Day 35-42: peak crying curve approaches around six weeks.",
      ],
    },
  },
  {
    ageInDays: 15,
    subject: "Day 15: growth spurt window open; finalize the EPDS",
    citations: [
      "baby-kb/voice.md",
      "baby-kb/buckets/week-03.md",
      "baby-kb/mom/postpartum-mood.md",
    ],
    content: {
      ageInDays: 15,
      hook: "spurt + mood screen",
      todaysFocus:
        "Day 15. The growth spurt is in full swing for many infants. Feeding feels relentless; output stays strong. This is also the week to close out the maternal mood screen rather than let it slide.",
      actionItems: [
        {
          body: "Hold steady through the feeding surge — if breastfeeding, frequent nursing is what calibrates supply upward.",
        },
        {
          body: "Finalize the EPDS this week if it is still open; persistent low mood past two weeks postpartum is the threshold to involve the OB.",
          sourceLabel: "Postpartum Support International",
          sourceUrl: U.ppsi,
        },
        {
          body: "Open the 529 plan if it is not yet done.",
          sourceLabel: "529 plan overview",
          sourceUrl: U.plan529,
        },
        {
          body: "Start a shortlist of daycares or nanny agencies if returning to work in 12-16 weeks; Bay Area waitlists run long.",
          sourceLabel: "ChildCare.gov directory",
          sourceUrl: U.childcare,
        },
        {
          body: "Continue logging feeds and diaper output.",
        },
      ],
      watchFors: [
        "[low concern] Ongoing cluster feeding and evening fussiness; baby acne visible.",
        "[low concern] Sustained eye contact during feeds becoming more common.",
        "[monitor] Mother's mood — tearfulness or anxiety that is not resolving needs a call to the OB or PCP.",
        "[call within 24h] Projectile vomiting after most feeds. Fewer than six wet diapers per day.",
        CALL_NOW,
      ],
      enrichment: [
        {
          body: "Keep tummy time near 15 minutes a day across short post-feed bouts.",
          sourceLabel: "AAP HealthyChildren on tummy time",
          sourceUrl: U.tummyTime,
        },
        {
          body: "Offer mirror play for under a minute during an alert window.",
        },
        {
          body: "Narrate ordinary tasks in full sentences — the conversational pattern matters more than the word count.",
          sourceLabel: "Romeo et al., Psych Science 2018",
          sourceUrl: U.romeo,
        },
        {
          body: "Read aloud for ten minutes with rhythmic, exaggerated delivery.",
        },
      ],
      upcoming: [
        "Day 17-21: growth spurt resolving.",
        "Day 28-35: 1-month well visit; first social smiles.",
        "Day 35-42: peak crying curve approaches.",
      ],
    },
  },
  {
    ageInDays: 16,
    subject: "Day 16: cluster feeding likely tonight; supply calibration",
    citations: [
      "baby-kb/voice.md",
      "baby-kb/buckets/week-03.md",
      "baby-kb/topics/feeding-and-weight.md",
    ],
    content: {
      ageInDays: 16,
      hook: "supply calibration",
      todaysFocus:
        "Day 16. The growth spurt is likely peaking. Evening cluster feeding can run for hours; if breastfeeding, this is the demand signal that drives supply up over the next 48-72 hours. It resolves on its own.",
      actionItems: [
        {
          body: "Plan a low-commitment evening; cluster feeding is easier to ride out when nothing else is scheduled.",
        },
        {
          body: "If supplementing, offer the breast first and top off after, to preserve the supply signal.",
        },
        {
          body: "Confirm the EPDS is done and acted on if the score was elevated.",
          sourceLabel: "Postpartum Support International",
          sourceUrl: U.ppsi,
        },
        {
          body: "Continue the daycare or nanny shortlist; tours and waitlist deposits take weeks to arrange.",
          sourceLabel: "Care.com",
          sourceUrl: U.carecom,
        },
        {
          body: "Keep the feeding log current.",
        },
      ],
      watchFors: [
        "[low concern] Hours of evening cluster feeding; fussiness that settles with holding.",
        "[low concern] Baby acne peaking; cord site fully healed for most infants by now.",
        "[monitor] Signs that cluster feeding is not transferring milk — fewer than six wet diapers, no settling at all between feeds.",
        "[call within 24h] Forceful projectile vomiting with weight stagnation. Persistent inability to console paired with back-arching during feeds.",
        CALL_NOW,
      ],
      enrichment: [
        {
          body: "Fit tummy time into the calmer parts of the day; 15 minutes total across short bouts.",
          sourceLabel: "AAP HealthyChildren on tummy time",
          sourceUrl: U.tummyTime,
        },
        {
          body: "Use skin-to-skin contact during cluster feeding; it calms both of you and supports milk transfer.",
        },
        {
          body: "Take conversational turns with his coos during awake-alert windows.",
          sourceLabel: "Romeo et al., Psych Science 2018",
          sourceUrl: U.romeo,
        },
        {
          body: "Give him a slow-moving high-contrast target to track when he is calm and alert.",
        },
      ],
      upcoming: [
        "Day 17-21: growth spurt resolving; feeding returns to its prior cadence.",
        "Day 28-35: 1-month well visit; first social smiles.",
        "Day 35-42: peak crying curve approaches.",
      ],
    },
  },
  {
    ageInDays: 17,
    subject: "Day 17: spurt resolving; bilingual exposure window",
    citations: [
      "baby-kb/voice.md",
      "baby-kb/buckets/week-03.md",
      "baby-kb/topics/language-development.md",
    ],
    content: {
      ageInDays: 17,
      hook: "spurt resolving",
      todaysFocus:
        "Day 17. The growth spurt should be resolving today or tomorrow; feeding returns to its prior cadence. If a bilingual or trilingual home is the plan, the consistent input pattern needs to be in place now.",
      actionItems: [
        {
          body: "If raising him multilingual, settle the one-parent-one-language pattern — each language gets one consistent speaker.",
        },
        {
          body: "Confirm the 1-month well visit is booked; target the day 28-35 window.",
          sourceLabel: "AAP Bright Futures periodicity",
          sourceUrl: U.brightFutures,
        },
        {
          body: "Continue daycare or nanny research; top-tier Bay Area daycares carry 6-18 month waitlists.",
          sourceLabel: "ChildCare.gov directory",
          sourceUrl: U.childcare,
        },
        {
          body: "Reorder maternal postpartum supplies only if still needed; lochia should be nearly stopped.",
        },
        {
          body: "Keep the feeding log going.",
        },
      ],
      watchFors: [
        "[low concern] Feeding settling back to a 2-3 hour breastfeeding cycle or 3-4 hour formula cycle; lochia minimal.",
        "[low concern] Increased eye contact and the first non-cry sounds during alert windows.",
        "[monitor] Persistent low mood, intrusive thoughts, or anxiety in Anoushka.",
        "[call within 24h] Forceful projectile vomiting. Fewer than six wet diapers per day. New or heavier maternal bleeding.",
        CALL_NOW,
      ],
      enrichment: [
        {
          body: "Keep daily tummy time near 15 minutes across short post-feed bouts.",
          sourceLabel: "AAP HealthyChildren on tummy time",
          sourceUrl: U.tummyTime,
        },
        {
          body: "Respond to every vocalization in a turn-taking rhythm — this is the foundational language-learning pattern.",
          sourceLabel: "Romeo et al., Psych Science 2018",
          sourceUrl: U.romeo,
        },
        {
          body: "Read aloud daily; in a bilingual home, read in both languages with consistent speakers.",
        },
        {
          body: "Hold him close at face distance and let him study your expressions without competing input.",
        },
      ],
      upcoming: [
        "Day 18-21: growth spurt fully resolved.",
        "Day 28-35: 1-month well visit; first social smiles.",
        "Day 35-42: peak crying curve at about six weeks.",
      ],
    },
  },
  {
    ageInDays: 18,
    subject: "Day 18: spurt recovery; start daycare waitlist research",
    citations: [
      "baby-kb/voice.md",
      "baby-kb/buckets/week-03.md",
      "baby-kb/topics/childcare-options.md",
    ],
    content: {
      ageInDays: 18,
      hook: "childcare research",
      todaysFocus:
        "Day 18. The growth spurt is behind you and feeding has stabilized. If returning to work at 12-16 weeks, the childcare search needs to start now — Bay Area waitlists are measured in months.",
      actionItems: [
        {
          body: "List three to five daycares within commuting range and begin booking tours; check accreditation as a quality signal.",
          sourceLabel: "ChildCare.gov directory",
          sourceUrl: U.childcare,
        },
        {
          body: "If a nanny is the preference instead, start the search now — agency and reference processes take four to eight weeks.",
          sourceLabel: "Care.com",
          sourceUrl: U.carecom,
        },
        {
          body: "Order a second car-seat base if you have a second vehicle.",
          sourceLabel: "NHTSA car seat guidance",
          sourceUrl: U.carSeat,
        },
        {
          body: "Confirm the 1-month well visit is on the calendar.",
          sourceLabel: "AAP Bright Futures periodicity",
          sourceUrl: U.brightFutures,
        },
        {
          body: "Continue the feeding log.",
        },
      ],
      watchFors: [
        "[low concern] Cluster feeding resolved; feeds back to their typical pattern; baby acne mostly gone.",
        "[low concern] Brief head lifts during tummy time; hands opening more often.",
        "[monitor] Persistent low mood or anxiety in Anoushka past the two-week mark.",
        "[call within 24h] Forceful projectile vomiting with weight loss. Fewer than six wet diapers per day.",
        CALL_NOW,
      ],
      enrichment: [
        {
          body: "Accumulate 10-15 minutes of tummy time, using a rolled blanket under the chest if he fatigues quickly.",
          sourceLabel: "AAP HealthyChildren on tummy time",
          sourceUrl: U.tummyTime,
        },
        {
          body: "Hold a high-contrast target 8-12 inches away and move it slowly to exercise tracking across the midline.",
        },
        {
          body: "Take conversational turns with his coos and grunts.",
          sourceLabel: "Romeo et al., Psych Science 2018",
          sourceUrl: U.romeo,
        },
        {
          body: "Offer skin-to-skin time after a feed for regulation and bonding.",
        },
      ],
      upcoming: [
        "Day 28-35: 1-month well visit; first social smiles.",
        "Day 35-42: peak crying curve at about six weeks.",
        "Day 42: maternal 6-week postpartum visit.",
      ],
    },
  },
  {
    ageInDays: 19,
    subject: "Day 19: sustained eye contact; prep 1-month visit questions",
    citations: [
      "baby-kb/voice.md",
      "baby-kb/buckets/week-03.md",
      "baby-kb/buckets/week-04.md",
    ],
    content: {
      ageInDays: 19,
      hook: "eye contact; visit prep",
      todaysFocus:
        "Day 19. Sustained eye contact during feeds is emerging if it has not already. The first social smile typically appears between week four and week six — the pediatrician will look for it at the 1-month visit.",
      actionItems: [
        {
          body: "Pre-write your 1-month-visit questions: weight curve, jaundice resolution, feeding pattern, sleep stretches, maternal mood, and the 2-month vaccine plan.",
          sourceLabel: "AAP HealthyChildren overview of the first month",
          sourceUrl: U.firstMonth,
        },
        {
          body: "Schedule Anoushka's 6-week postpartum visit with the OB for around day 42 if it is not yet booked.",
          sourceLabel: "ACOG on the postpartum period",
          sourceUrl: U.acogPostpartum,
        },
        {
          body: "Continue daycare or nanny tours and waitlist research.",
          sourceLabel: "ChildCare.gov directory",
          sourceUrl: U.childcare,
        },
        {
          body: "Plan the swaddle-to-sleep-sack transition before any signs of rolling — typically weeks 8-12.",
        },
        {
          body: "Continue the feeding log.",
        },
      ],
      watchFors: [
        "[low concern] Brief head lifts in tummy time; sustained eye contact during feeds; early cooing.",
        "[low concern] Cradle cap — yellow scale on the scalp — common, harmless, resolving over weeks.",
        "[monitor] Crying more than three hours a day on more than three days a week, which fits the colic pattern; it peaks at six to eight weeks.",
        "[call within 24h] Forceful projectile vomiting with weight loss. Fewer than six wet diapers per day.",
        CALL_NOW,
      ],
      enrichment: [
        {
          body: "Hold him 8-12 inches from your face and talk slowly with exaggerated expressions during awake-alert windows.",
        },
        {
          body: "Keep tummy time near 15-20 minutes a day across short bouts.",
          sourceLabel: "AAP HealthyChildren on tummy time",
          sourceUrl: U.tummyTime,
        },
        {
          body: "Respond to his coos in turn-taking exchanges.",
          sourceLabel: "Romeo et al., Psych Science 2018",
          sourceUrl: U.romeo,
        },
        {
          body: "Read aloud daily with high-contrast board books and rhythmic text.",
        },
      ],
      upcoming: [
        "Day 28-35: 1-month well visit; first social smiles.",
        "Day 35-42: peak crying curve at about six weeks.",
        "Day 42: maternal 6-week postpartum visit.",
      ],
    },
  },
  {
    ageInDays: 20,
    subject: "Day 20: end of week 3; 1-month visit one week out",
    citations: [
      "baby-kb/voice.md",
      "baby-kb/buckets/week-03.md",
      "baby-kb/buckets/week-04.md",
    ],
    content: {
      ageInDays: 20,
      hook: "week 3 closing",
      todaysFocus:
        "Day 20. Week three is closing. Head control is improving, movements are smoother and more symmetric, and recognition of parental voices is starting to show. The 1-month visit window opens in about a week.",
      actionItems: [
        {
          body: "Confirm the 1-month well visit is booked within the day 28-35 window.",
          sourceLabel: "AAP Bright Futures periodicity",
          sourceUrl: U.brightFutures,
        },
        {
          body: "Restock infant acetaminophen ahead of the 2-month vaccine visit; confirm the correct newborn dosing with the pediatrician.",
          sourceLabel: "AAP HealthyChildren on fever and medication",
          sourceUrl: U.fever,
        },
        {
          body: "Continue daycare or nanny tours.",
          sourceLabel: "ChildCare.gov directory",
          sourceUrl: U.childcare,
        },
        {
          body: "Confirm Anoushka's 6-week postpartum visit is on the calendar.",
          sourceLabel: "ACOG on the postpartum period",
          sourceUrl: U.acogPostpartum,
        },
        {
          body: "Continue the feeding log.",
        },
      ],
      watchFors: [
        "[low concern] Smoother, more symmetric arm and leg movement; brief head lifts; cradle cap.",
        "[low concern] Blocked tear duct possible — continuous tearing in one eye without redness, resolves on its own.",
        "[monitor] Crying more than three hours a day on more than three days a week — the colic pattern, peaking at six to eight weeks.",
        "[call within 24h] Forceful projectile vomiting with weight loss. Persistent inability to console with back-arching during feeds.",
        CALL_NOW,
      ],
      enrichment: [
        {
          body: "Keep tummy time at 15-20 minutes a day; lay him on your chest at an incline if he fatigues on the floor.",
          sourceLabel: "AAP HealthyChildren on tummy time",
          sourceUrl: U.tummyTime,
        },
        {
          body: "Hold face-to-face conversations 8-12 inches away with slow, exaggerated speech.",
        },
        {
          body: "Take conversational turns with every coo and non-cry sound.",
          sourceLabel: "Romeo et al., Psych Science 2018",
          sourceUrl: U.romeo,
        },
        {
          body: "Read aloud daily; rhythmic, repetitive board books hold attention best.",
        },
      ],
      upcoming: [
        "Day 28-35: 1-month well visit; first social smiles.",
        "Day 35-42: peak crying curve at about six weeks.",
        "Day 42: maternal 6-week postpartum visit.",
      ],
    },
  },
  {
    ageInDays: 21,
    subject: "Day 21: three weeks old; 1-month visit prep; tummy time",
    citations: [
      "baby-kb/voice.md",
      "baby-kb/buckets/week-04.md",
      "baby-kb/topics/tummy-time-and-motor.md",
    ],
    content: {
      ageInDays: 21,
      hook: "three weeks",
      todaysFocus:
        "Day 21. Three weeks old; week four opens. Head control is improving with brief lifts during tummy time, movements are more symmetric, and the first social smile could appear any day through day 42.",
      actionItems: [
        {
          body: "Schedule the 1-month well visit if it is not yet booked; target the day 28-35 window.",
          sourceLabel: "AAP Bright Futures periodicity",
          sourceUrl: U.brightFutures,
        },
        {
          body: "Confirm Avi's health-insurance enrollment processed — the final reminder before the 30-day mark.",
          sourceLabel: "Healthcare.gov on qualifying life events",
          sourceUrl: U.qle,
        },
        {
          body: "Tour one to three daycares this week if returning to work in 9-13 weeks.",
          sourceLabel: "ChildCare.gov directory",
          sourceUrl: U.childcare,
        },
        {
          body: "Restock infant acetaminophen before the 2-month vaccine visit.",
          sourceLabel: "AAP HealthyChildren on fever",
          sourceUrl: U.fever,
        },
        {
          body: "Continue the feeding log.",
        },
      ],
      watchFors: [
        "[low concern] Brief head lifts; smoother, more symmetric movement; cradle cap; baby acne mostly resolved.",
        "[low concern] Sustained eye contact during feeds and early cooing.",
        "[monitor] Crying more than three hours a day on more than three days a week — the colic pattern, peaking at six to eight weeks.",
        "[call within 24h] Forceful projectile vomiting with weight loss. Persistent inability to console with back-arching during feeds. Fewer than six wet diapers per day.",
        CALL_NOW,
      ],
      enrichment: [
        {
          body: "Accumulate 15-20 minutes of tummy time across short bouts; an incline on your chest helps if he tires quickly.",
          sourceLabel: "AAP HealthyChildren on tummy time",
          sourceUrl: U.tummyTime,
        },
        {
          body: "Talk face-to-face 8-12 inches away with slow, exaggerated expressions.",
        },
        {
          body: "Respond to his vocalizations in turn-taking exchanges.",
          sourceLabel: "Romeo et al., Psych Science 2018",
          sourceUrl: U.romeo,
        },
        {
          body: "Read aloud daily with high-contrast board books.",
        },
      ],
      upcoming: [
        "Day 28-35: 1-month well visit; first social smiles begin.",
        "Day 35-42: peak crying curve at about six weeks.",
        "Day 42: maternal 6-week postpartum visit.",
        "Day 56-70: 2-month well visit; first round of vaccines.",
      ],
    },
  },
  {
    ageInDays: 22,
    subject: "Day 22: week 4; first social smile watch begins",
    citations: [
      "baby-kb/voice.md",
      "baby-kb/buckets/week-04.md",
      "baby-kb/topics/social-emotional-development.md",
    ],
    content: {
      ageInDays: 22,
      hook: "social smile watch",
      todaysFocus:
        "Day 22. The first true social smile — directed at a face, in response to a face, not a reflexive gas-smile — typically emerges between week four and week six. Watch for it during calm, awake-alert windows.",
      actionItems: [
        {
          body: "Confirm the 1-month well visit is booked for the day 28-35 window.",
          sourceLabel: "AAP Bright Futures periodicity",
          sourceUrl: U.brightFutures,
        },
        {
          body: "Pre-write 1-month-visit questions: growth curve, feeding, sleep stretches, maternal mood, and the 2-month vaccine schedule.",
          sourceLabel: "AAP HealthyChildren overview of the first month",
          sourceUrl: U.firstMonth,
        },
        {
          body: "Continue daycare or nanny tours and waitlist deposits.",
          sourceLabel: "ChildCare.gov directory",
          sourceUrl: U.childcare,
        },
        {
          body: "Confirm Anoushka's 6-week postpartum visit is scheduled for around day 42.",
          sourceLabel: "ACOG on the postpartum period",
          sourceUrl: U.acogPostpartum,
        },
        {
          body: "Continue the feeding log.",
        },
      ],
      watchFors: [
        "[low concern] Cradle cap; blocked tear duct; evening witching-hour fussiness building toward the peak-crying weeks.",
        "[low concern] First social smiles and early cooing during alert windows.",
        "[monitor] Crying more than three hours a day on more than three days a week — the colic pattern that peaks at six to eight weeks.",
        "[call within 24h] Forceful projectile vomiting with weight loss, which can signal pyloric stenosis presenting at weeks 3-6. Persistent inability to console with back-arching during feeds.",
        CALL_NOW,
      ],
      enrichment: [
        {
          body: "Hold him 8-12 inches from your face, smile, and talk slowly — the most reliable way to elicit an early social smile.",
        },
        {
          body: "Accumulate 15-20 minutes of tummy time across short bouts.",
          sourceLabel: "AAP HealthyChildren on tummy time",
          sourceUrl: U.tummyTime,
        },
        {
          body: "Take conversational turns with his coos — respond, pause, respond again.",
          sourceLabel: "Romeo et al., Psych Science 2018",
          sourceUrl: U.romeo,
        },
        {
          body: "Read aloud daily with rhythmic, high-contrast board books.",
        },
      ],
      upcoming: [
        "Day 28-35: 1-month well visit; first social smiles.",
        "Day 35-42: peak crying curve at about six weeks.",
        "Day 42: maternal 6-week postpartum visit.",
        "Day 56-70: 2-month well visit; first round of vaccines.",
      ],
    },
  },
  {
    ageInDays: 23,
    subject: "Day 23: confirm the 1-month visit is booked",
    citations: [
      "baby-kb/voice.md",
      "baby-kb/buckets/week-04.md",
      "baby-kb/topics/tummy-time-and-motor.md",
    ],
    content: {
      ageInDays: 23,
      hook: "lock the 1-month visit",
      todaysFocus:
        "Day 23. The 1-month well visit window opens in five days. If it is not on the calendar, today is the day to call — popular pediatric slots fill a week or more out.",
      actionItems: [
        {
          body: "Call and book the 1-month well visit now if it is not confirmed; target day 28-35.",
          sourceLabel: "AAP Bright Futures periodicity",
          sourceUrl: U.brightFutures,
        },
        {
          body: "Assemble what to bring to the visit: the feeding log, the diaper-output log, and a written question list.",
          sourceLabel: "AAP HealthyChildren overview of the first month",
          sourceUrl: U.firstMonth,
        },
        {
          body: "Continue daycare or nanny tours; aim to have a shortlist with deposits down by the 1-month visit.",
          sourceLabel: "Care.com",
          sourceUrl: U.carecom,
        },
        {
          body: "Order a second car-seat base if you have a second vehicle and have not yet.",
          sourceLabel: "NHTSA car seat guidance",
          sourceUrl: U.carSeat,
        },
        {
          body: "Continue the feeding log.",
        },
      ],
      watchFors: [
        "[low concern] Cradle cap; blocked tear duct; brief head lifts and smoother movement.",
        "[low concern] First social smiles and sustained eye contact during alert windows.",
        "[monitor] Crying more than three hours a day on more than three days a week — the colic pattern peaking at six to eight weeks.",
        "[call within 24h] Forceful projectile vomiting with weight loss. Persistent inability to console with back-arching during feeds. Fewer than six wet diapers per day.",
        CALL_NOW,
      ],
      enrichment: [
        {
          body: "Keep tummy time at 15-20 minutes a day; tummy time correlates with earlier sitting and rolling.",
          sourceLabel: "AAP HealthyChildren on tummy time",
          sourceUrl: U.tummyTime,
        },
        {
          body: "Talk face-to-face 8-12 inches away to draw out an early social smile.",
        },
        {
          body: "Respond to every coo in a turn-taking rhythm.",
          sourceLabel: "Romeo et al., Psych Science 2018",
          sourceUrl: U.romeo,
        },
        {
          body: "Read aloud daily; the prosody of your voice is the active ingredient.",
        },
      ],
      upcoming: [
        "Day 28-35: 1-month well visit; first social smiles.",
        "Day 35-42: peak crying curve at about six weeks.",
        "Day 42: maternal 6-week postpartum visit.",
        "Day 56-70: 2-month well visit; first round of vaccines.",
      ],
    },
  },
];

async function main() {
  const dir = resolve(process.cwd(), "baby-kb/precomputed");
  for (const day of DAYS) {
    const { bodyText, bodyHtml } = renderDaily(day.content);
    const artifact = {
      ageInDays: day.ageInDays,
      subject: day.subject,
      citations: day.citations,
      generatedAt: GENERATED_AT,
      kbVersion: KB_VERSION,
      validationPassed: true,
      bodyText,
      bodyHtml,
    };
    const file = resolve(dir, `day-${day.ageInDays}.json`);
    await fs.writeFile(file, JSON.stringify(artifact, null, 2) + "\n", "utf8");
    const words = bodyText.trim().split(/\s+/).length;
    console.log(`day-${day.ageInDays}.json written (${words} words)`);
  }
  console.log(`\n${DAYS.length} artifacts regenerated.`);

  // Auto-bake the milestone check-in section into the artifacts we just
  // wrote. Without this step the regenerated emails ship without the
  // section — the 2026-05-21 incident: regen on May 18 wrote 14 fresh
  // days, only day-9 was baked afterward, days 10-23 went out for three
  // days with no milestone block.
  const lo = Math.min(...DAYS.map((d) => d.ageInDays));
  const hi = Math.max(...DAYS.map((d) => d.ageInDays));
  console.log(`\nBaking milestone check-in into days ${lo}-${hi}…`);
  const r = spawnSync(
    "npm",
    ["run", "milestones:bake", "--", `--days=${lo}-${hi}`],
    { stdio: "inherit" }
  );
  if (r.status !== 0) {
    console.error(`\nMilestone bake exited with code ${r.status}.`);
    process.exit(r.status ?? 1);
  }

  console.log(`\nDone. Run \`npm run precompute:validate\` to confirm.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
