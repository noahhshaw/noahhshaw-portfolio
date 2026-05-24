/* eslint-disable no-console */
/**
 * Author + render days 24-42 (19 daily artifacts). Covers the
 * tail of week 4, all of weeks 5 and 6 (peak-crying curve, 1-month
 * visit follow-through, maternal 6-week postpartum visit). Auto-bakes
 * the milestone check-in section at the end.
 *
 * Run: npm run baby:regen-24-42
 */
import { promises as fs } from "fs";
import { resolve } from "path";
import { spawnSync } from "child_process";
import { renderDaily, type DailyContent } from "@/lib/baby/render-daily";

const GENERATED_AT = "2026-05-21T18:00:00Z";
const KB_VERSION = "2026-05-21-regen";

const U = {
  brightFutures:
    "https://www.aap.org/en/practice-management/bright-futures/bright-futures-tools-and-resources/",
  cordCare:
    "https://www.healthychildren.org/English/ages-stages/baby/bathing-skin-care/Pages/Umbilical-Cord-Care.aspx",
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
  vaccines:
    "https://www.aap.org/en/patient-care/immunizations/aap-policy-on-immunizations/",
  vitaminD:
    "https://www.healthychildren.org/English/healthy-living/nutrition/Pages/Vitamin-D-On-the-Double.aspx",
  cdc4mo: "https://www.cdc.gov/act-early/milestones/4-months.html",
  cdc2mo: "https://www.cdc.gov/act-early/milestones/2-months.html",
  acogPpAptd:
    "https://www.acog.org/womens-health/faqs/postpartum-birth-control",
};

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
    ageInDays: 24,
    subject: "Day 24: social smile watch; 1-month visit later this week",
    citations: [
      "baby-kb/voice.md",
      "baby-kb/buckets/week-04.md",
      "baby-kb/topics/social-emotional-development.md",
    ],
    content: {
      ageInDays: 24,
      hook: "social smile window",
      todaysFocus:
        "Day 24. The first true social smile typically appears between week four and week six. Today is well inside that window. Eye contact during feeds is sustained and hands open more often.",
      actionItems: [
        {
          body: "Confirm the 1-month well visit is on the calendar; if it is not, call today.",
          sourceLabel: "AAP Bright Futures periodicity",
          sourceUrl: U.brightFutures,
        },
        {
          body: "Pre-write the questions for the visit: weight curve, jaundice resolution, feeding pattern, sleep stretches, maternal mood, 2-month vaccine plan.",
          sourceLabel: "AAP HealthyChildren first-month overview",
          sourceUrl: U.firstMonth,
        },
        {
          body: "Pack the feeding log and diaper-output notes to bring with you.",
        },
        {
          body: "If returning to work in 9-13 weeks and a nanny is the plan, schedule reference checks for top candidates.",
          sourceLabel: "Care.com",
          sourceUrl: U.carecom,
        },
        {
          body: "Restock infant acetaminophen ahead of the 2-month vaccine visit.",
          sourceLabel: "AAP HealthyChildren on fever",
          sourceUrl: U.fever,
        },
      ],
      watchFors: [
        "[low concern] First social smiles; sustained eye contact; cradle cap; blocked tear duct without redness.",
        "[low concern] Brief head lifts; hands opening; smoother symmetric movements.",
        "[monitor] Crying more than three hours a day on more than three days a week — the colic pattern, peaking at six to eight weeks.",
        "[call within 24h] Forceful projectile vomiting with weight loss (pyloric stenosis presents weeks 3-6). Persistent inability to console with back-arching during feeds.",
        CALL_NOW,
      ],
      enrichment: [
        {
          body: "Face-to-face talking 8-12 inches away with slow exaggerated expressions; the most reliable way to elicit an early social smile.",
        },
        {
          body: "Tummy time 15-20 minutes a day across short post-feed bouts.",
          sourceLabel: "AAP HealthyChildren on tummy time",
          sourceUrl: U.tummyTime,
        },
        {
          body: "Respond to every coo in a turn-taking rhythm.",
          sourceLabel: "Romeo et al., Psych Science 2018",
          sourceUrl: U.romeo,
        },
        {
          body: "Read aloud daily; the rhythm of your voice is the active ingredient.",
        },
      ],
      upcoming: [
        "Day 28-35: 1-month well visit; first social smiles.",
        "Day 35-42: peak-crying curve at about six weeks.",
        "Day 42: maternal 6-week postpartum visit.",
        "Day 56-70: 2-month well visit; first round of vaccines.",
      ],
    },
  },
  {
    ageInDays: 25,
    subject: "Day 25: 1-month visit window opens; bring the feeding log",
    citations: [
      "baby-kb/voice.md",
      "baby-kb/buckets/week-04.md",
      "baby-kb/topics/feeding-and-weight.md",
    ],
    content: {
      ageInDays: 25,
      hook: "1-month visit opens",
      todaysFocus:
        "Day 25. The 1-month well visit window opens this week (day 28-35). If today is the visit, bring the feeding log, the diaper-output notes, and a written question list — the time goes fast.",
      actionItems: [
        {
          body: "Bring the feeding log, diaper-output notes, and written questions to the 1-month visit.",
          sourceLabel: "AAP HealthyChildren first-month overview",
          sourceUrl: U.firstMonth,
        },
        {
          body: "Ask the pediatrician about jaundice resolution, weight trajectory, and the 2-month vaccine schedule.",
          sourceLabel: "AAP on immunizations",
          sourceUrl: U.vaccines,
        },
        {
          body: "Confirm Anoushka's 6-week postpartum OB visit is scheduled for around day 42.",
          sourceLabel: "ACOG on the postpartum period",
          sourceUrl: U.acogPostpartum,
        },
        {
          body: "Continue daycare tours and waitlist deposits.",
          sourceLabel: "ChildCare.gov directory",
          sourceUrl: U.childcare,
        },
        {
          body: "Order a second car-seat base if you have a second vehicle and have not yet.",
          sourceLabel: "NHTSA car seat guidance",
          sourceUrl: U.carSeat,
        },
      ],
      watchFors: [
        "[low concern] Cradle cap on the scalp; blocked tear duct; brief head lifts during tummy time.",
        "[low concern] Early cooing and first social smiles during alert windows.",
        "[monitor] Crying patterns trending toward more than three hours a day; colic peaks at six to eight weeks.",
        "[call within 24h] Forceful projectile vomiting with weight loss. Fewer than six wet diapers per day.",
        CALL_NOW,
      ],
      enrichment: [
        {
          body: "Tummy time 15-20 minutes a day across short bouts; use a chest-incline if floor time fatigues him.",
          sourceLabel: "AAP HealthyChildren on tummy time",
          sourceUrl: U.tummyTime,
        },
        {
          body: "Face-to-face talking with exaggerated expressions to draw out early social smiles.",
        },
        {
          body: "Read aloud daily; high-contrast board books with rhythmic text hold attention best.",
        },
        {
          body: "Respond to every vocalization in a turn-taking exchange.",
          sourceLabel: "Romeo et al., Psych Science 2018",
          sourceUrl: U.romeo,
        },
      ],
      upcoming: [
        "Day 28-35: 1-month well visit window.",
        "Day 35-42: peak-crying curve.",
        "Day 42: maternal 6-week postpartum visit.",
        "Day 56-70: 2-month well visit; first round of vaccines.",
      ],
    },
  },
  {
    ageInDays: 26,
    subject: "Day 26: post-visit follow-through; first cooing sounds",
    citations: [
      "baby-kb/voice.md",
      "baby-kb/buckets/week-04.md",
      "baby-kb/topics/language-development.md",
    ],
    content: {
      ageInDays: 26,
      hook: "post-visit follow-through",
      todaysFocus:
        "Day 26. If the 1-month visit was earlier this week, follow through on what the pediatrician flagged. Vowel sounds (ah, ooh) are emerging during awake-alert windows.",
      actionItems: [
        {
          body: "Act on anything the pediatrician flagged at the 1-month visit (latch correction, supplementation pattern, vitamin D dosing).",
          sourceLabel: "AAP HealthyChildren on vitamin D",
          sourceUrl: U.vitaminD,
        },
        {
          body: "Confirm vitamin D 400 IU/day is in place if breastfeeding exclusively or predominantly.",
          sourceLabel: "AAP HealthyChildren on vitamin D",
          sourceUrl: U.vitaminD,
        },
        {
          body: "Schedule the 2-month well visit if it is not already booked (target day 56-70).",
          sourceLabel: "AAP Bright Futures periodicity",
          sourceUrl: U.brightFutures,
        },
        {
          body: "If returning to work soon, confirm daycare or nanny start date matches the return date with a 1-2 week buffer.",
          sourceLabel: "ChildCare.gov directory",
          sourceUrl: U.childcare,
        },
        {
          body: "Continue the feeding log.",
        },
      ],
      watchFors: [
        "[low concern] First vowel coos (ah, ooh); social smiles; sustained eye contact.",
        "[low concern] Cradle cap; blocked tear duct without redness.",
        "[monitor] Crying more than three hours a day on more than three days a week; colic peaks at six to eight weeks.",
        "[call within 24h] Forceful projectile vomiting with weight loss. Persistent inability to console with back-arching during feeds.",
        CALL_NOW,
      ],
      enrichment: [
        {
          body: "Take conversational turns with each vocalization — respond, pause, respond again. Turn-taking is the foundational language pattern.",
          sourceLabel: "Romeo et al., Psych Science 2018",
          sourceUrl: U.romeo,
        },
        {
          body: "Face-to-face talking with exaggerated expressions during alert windows.",
        },
        {
          body: "Tummy time near 20 minutes a day across short bouts.",
          sourceLabel: "AAP HealthyChildren on tummy time",
          sourceUrl: U.tummyTime,
        },
        {
          body: "Read aloud the same three to five board books on rotation; repetition supports rhythm recognition.",
        },
      ],
      upcoming: [
        "Day 28-35: 1-month well visit window (if not yet done).",
        "Day 35-42: peak-crying curve.",
        "Day 42: maternal 6-week postpartum visit.",
        "Day 56-70: 2-month well visit; first round of vaccines.",
      ],
    },
  },
  {
    ageInDays: 27,
    subject: "Day 27: end of week 4; feeding cadence stable",
    citations: [
      "baby-kb/voice.md",
      "baby-kb/buckets/week-04.md",
      "baby-kb/topics/feeding-and-weight.md",
    ],
    content: {
      ageInDays: 27,
      hook: "end of week 4",
      todaysFocus:
        "Day 27. End of week four. Feeding cadence is stable, weight gain is visible, and the first social smile may already have appeared. Tomorrow opens the peak-crying weeks.",
      actionItems: [
        {
          body: "If the 1-month visit is still pending, confirm or schedule today.",
          sourceLabel: "AAP Bright Futures periodicity",
          sourceUrl: U.brightFutures,
        },
        {
          body: "Read up on the peak-crying curve before the peak so the upcoming evenings feel expected, not alarming.",
          sourceLabel: "AAP HealthyChildren on crying and colic",
          sourceUrl: U.crying,
        },
        {
          body: "Lock daycare or nanny start dates; coordinate the 1-2 week overlap with paid leave if possible.",
          sourceLabel: "ChildCare.gov directory",
          sourceUrl: U.childcare,
        },
        {
          body: "Order pumping supplies if Anoushka will pump after returning to work; the double-electric pump is typically covered by insurance under ACA.",
        },
        {
          body: "Continue the feeding log.",
        },
      ],
      watchFors: [
        "[low concern] Smoother movements; first social smiles; cradle cap.",
        "[low concern] Evening fussiness building toward the peak-crying weeks.",
        "[monitor] Persistent low mood or anxiety in Anoushka — the EPDS rescreen is one to two weeks out.",
        "[call within 24h] Forceful projectile vomiting with weight loss. Fewer than six wet diapers per day.",
        CALL_NOW,
      ],
      enrichment: [
        {
          body: "Tummy time 20 minutes a day across short bouts; build tolerance toward the 30-minute week-six target.",
          sourceLabel: "AAP HealthyChildren on tummy time",
          sourceUrl: U.tummyTime,
        },
        {
          body: "Face-to-face talking to draw out smiles and coos.",
        },
        {
          body: "Read aloud daily on rotation with three to five favorite board books.",
        },
        {
          body: "Take conversational turns with every vocalization.",
          sourceLabel: "Romeo et al., Psych Science 2018",
          sourceUrl: U.romeo,
        },
      ],
      upcoming: [
        "Day 28-35: peak crying curve begins.",
        "Day 28-35: 1-month well visit (if not yet done).",
        "Day 42: maternal 6-week postpartum visit.",
        "Day 56-70: 2-month well visit; first round of vaccines.",
      ],
    },
  },
  {
    ageInDays: 28,
    subject: "Day 28: week 5; peak-crying curve approaches",
    citations: [
      "baby-kb/voice.md",
      "baby-kb/buckets/week-05.md",
      "baby-kb/topics/colic-and-crying.md",
    ],
    content: {
      ageInDays: 28,
      hook: "peak-crying approaches",
      todaysFocus:
        "Day 28. Four weeks old; week five opens. You are near the front edge of the peak-crying curve — inconsolable evenings peak around six weeks. This is normal and self-limited; it is not a parenting failure.",
      actionItems: [
        {
          body: "Confirm the 1-month visit happened and the growth chart is on track.",
          sourceLabel: "AAP Bright Futures periodicity",
          sourceUrl: U.brightFutures,
        },
        {
          body: "Read about the 5 S's (swaddle, side hold, shush, swing, suck) so you have a settling sequence to try on hard nights.",
          sourceLabel: "AAP HealthyChildren on crying and colic",
          sourceUrl: U.crying,
        },
        {
          body: "Pre-schedule the 2-month well visit for day 56-70 if not yet done; vaccines will include HepB, RV, DTaP, Hib, PCV, IPV.",
          sourceLabel: "AAP on immunizations",
          sourceUrl: U.vaccines,
        },
        {
          body: "Active daycare or nanny interviews if returning to work in 7-11 weeks.",
          sourceLabel: "ChildCare.gov directory",
          sourceUrl: U.childcare,
        },
        {
          body: "Continue the feeding log.",
        },
      ],
      watchFors: [
        "[low concern] Inconsolable crying in the evenings with no clear cause — peak crying is normal at this age. Hiccups during feeds. Wet sneezing.",
        "[low concern] More sustained head lifts in tummy time, social smiles, brief tracking across the visual field.",
        "[monitor] Forceful arching during or after feeds, painful spit-up, refusal to feed despite hunger cues — possible GERD or CMPI; raise at the next visit.",
        "[call within 24h] Bloody-mucus stool (possible cow's-milk-protein intolerance or anal fissure). Sustained refusal of feeds.",
        CALL_NOW,
      ],
      enrichment: [
        {
          body: "Tummy time 20-30 minutes a day cumulative. The football hold (drape across your forearm) is a useful variation when floor time stalls.",
          sourceLabel: "AAP HealthyChildren on tummy time",
          sourceUrl: U.tummyTime,
        },
        {
          body: "Read aloud 15 minutes a day on rotation.",
        },
        {
          body: "Sing live during diaper changes and bath time — the serve-and-return cadence is the active ingredient.",
        },
        {
          body: "If raising bilingual, the second-language parent is at the always-second-language threshold by now.",
        },
      ],
      upcoming: [
        "Day 35-42: peak crying at about six weeks.",
        "Day 42: maternal 6-week postpartum visit (OB clearance for exercise; EPDS rescreen).",
        "Day 56-70: 2-month well visit; first round of vaccines.",
      ],
    },
  },
  {
    ageInDays: 29,
    subject: "Day 29: peak-crying primer; the 5 S's",
    citations: [
      "baby-kb/voice.md",
      "baby-kb/buckets/week-05.md",
      "baby-kb/topics/colic-and-crying.md",
    ],
    content: {
      ageInDays: 29,
      hook: "peak crying primer",
      todaysFocus:
        "Day 29. The peak-crying pattern: unexpected episodes, resistant to soothing, pain-like facial expressions that are not pain, long duration, clustered in the evenings. It peaks at about six weeks and tapers by three to four months. Recognizing the pattern is half the recovery.",
      actionItems: [
        {
          body: "Read the peak-crying overview together so both parents share the same mental model when the evenings are hard.",
          sourceLabel: "AAP HealthyChildren on crying and colic",
          sourceUrl: U.crying,
        },
        {
          body: "Stock the kitchen for the evening hours; dinner that takes both hands does not work this week.",
        },
        {
          body: "Agree on a rotation for who handles the worst evening hours so the same parent is not on every night.",
        },
        {
          body: "If a feeding problem is suspected behind the crying — back arching, refusal, painful spit-up — message the pediatrician before the next visit.",
          sourceLabel: "AAP HealthyChildren on crying and colic",
          sourceUrl: U.crying,
        },
        {
          body: "Continue the feeding log.",
        },
      ],
      watchFors: [
        "[low concern] Evening cluster fussiness; pain-like facial expressions during crying that are NOT pain.",
        "[low concern] Hiccups and wet sneezing; quiet startle on loud sounds.",
        "[monitor] Forceful arching with feeds, painful spit-up, or feeding refusal — discuss at the next visit.",
        "[call within 24h] Bloody-mucus stool. Sustained feeding refusal. Persistent inconsolability paired with lethargy or fever.",
        CALL_NOW,
      ],
      enrichment: [
        {
          body: "Practice the 5 S's during a calm period so the sequence is ready for the harder hours: swaddle, side or stomach hold (only while held and awake), shush, swing, suck.",
          sourceLabel: "AAP HealthyChildren on crying and colic",
          sourceUrl: U.crying,
        },
        {
          body: "Tummy time 20-30 minutes a day cumulative.",
          sourceLabel: "AAP HealthyChildren on tummy time",
          sourceUrl: U.tummyTime,
        },
        {
          body: "Take conversational turns with every coo during calm windows.",
          sourceLabel: "Romeo et al., Psych Science 2018",
          sourceUrl: U.romeo,
        },
        {
          body: "Outdoor stroller walk for 20-30 minutes most days — useful for both of you.",
        },
      ],
      upcoming: [
        "Day 35-42: crying at or near peak.",
        "Day 42: maternal 6-week postpartum visit.",
        "Day 56-70: 2-month well visit and first vaccines.",
      ],
    },
  },
  {
    ageInDays: 30,
    subject: "Day 30: one month; routines firming; help-network check",
    citations: [
      "baby-kb/voice.md",
      "baby-kb/buckets/week-05.md",
      "baby-kb/topics/parental-sleep-and-recovery.md",
    ],
    content: {
      ageInDays: 30,
      hook: "one month in",
      todaysFocus:
        "Day 30. One month. Feeding cadence is steady, social smiles are appearing more reliably, and head control is visibly stronger. With the harder weeks ahead, this is the right day to firm up the help network rather than improvise it later.",
      actionItems: [
        {
          body: "List the two or three people you can call at 2am for an extra set of hands — a relative, a postpartum doula, a close friend. Confirm each is actually willing and on the same coast.",
        },
        {
          body: "Settle a working evening-rotation plan between Anoushka and Noah for the cluster-fussy hours; write it on the fridge so it is not renegotiated at the moment of need.",
        },
        {
          body: "Verify Avi is covered on the health-insurance plan and the insurance card or member number is accessible from your phone.",
          sourceLabel: "Healthcare.gov on qualifying life events",
          sourceUrl: U.qle,
        },
        {
          body: "Confirm the 2-month well visit is scheduled.",
          sourceLabel: "AAP Bright Futures periodicity",
          sourceUrl: U.brightFutures,
        },
        {
          body: "Continue the feeding log.",
        },
      ],
      watchFors: [
        "[low concern] Evening cluster fussiness; hiccups during or after feeds; quiet startle to loud sounds.",
        "[low concern] Brief head lifts during tummy time; social smiles consolidating.",
        "[monitor] Caregiver burnout signals — short fuse, dread of evenings, persistent low mood — name them out loud before the worst night.",
        "[call within 24h] Sustained feeding refusal. Forceful projectile vomiting. Fewer than six wet diapers per day.",
        CALL_NOW,
      ],
      enrichment: [
        {
          body: "Tummy time 20-30 minutes a day across multiple bouts.",
          sourceLabel: "AAP HealthyChildren on tummy time",
          sourceUrl: U.tummyTime,
        },
        {
          body: "Read aloud 15 minutes a day.",
        },
        {
          body: "Live singing during low-stress routines like diapering and bathing.",
        },
        {
          body: "Outdoor walk in the stroller for 20-30 minutes most days — vitamin D for him and cardiovascular recovery for you.",
          sourceLabel: "AAP HealthyChildren on vitamin D",
          sourceUrl: U.vitaminD,
        },
      ],
      upcoming: [
        "Day 35-42: peak crying.",
        "Day 42: maternal 6-week postpartum visit.",
        "Day 56-70: 2-month well visit; first vaccines.",
      ],
    },
  },
  {
    ageInDays: 31,
    subject: "Day 31: insurance check; pumping supplies if needed",
    citations: [
      "baby-kb/voice.md",
      "baby-kb/buckets/week-05.md",
      "baby-kb/topics/return-to-work-planning.md",
    ],
    content: {
      ageInDays: 31,
      hook: "logistics calibration",
      todaysFocus:
        "Day 31. Feeding rhythm is steady, evenings are getting harder, and the back half of parental leave is in view. Today is a good day to close the last logistics loops.",
      actionItems: [
        {
          body: "Order pumping supplies through Anoushka's insurer if pumping after return to work; the double-electric pump is typically covered under ACA.",
        },
        {
          body: "Confirm the daycare or nanny start date matches the return-to-work date with a 1-2 week buffer.",
          sourceLabel: "Care.com",
          sourceUrl: U.carecom,
        },
        {
          body: "Refill the medicine drawer: infant acetaminophen, saline drops, bulb syringe, digital rectal thermometer.",
          sourceLabel: "AAP HealthyChildren on fever",
          sourceUrl: U.fever,
        },
        {
          body: "Plan a paternity-to-maternity-leave overlap if both parents are still home; cluster crying is easier on two adults.",
        },
        {
          body: "Continue the feeding log.",
        },
      ],
      watchFors: [
        "[low concern] Evening cluster fussiness building; social smiles emerging; head control improving.",
        "[low concern] Quiet startle and hiccups during or after feeds.",
        "[monitor] Forceful arching during feeds or refusal despite hunger cues — possible reflux or CMPI; raise at the next visit.",
        "[call within 24h] Sustained feeding refusal. Bloody-mucus stool. Fewer than six wet diapers per day.",
        CALL_NOW,
      ],
      enrichment: [
        {
          body: "Tummy time 20-30 minutes a day; use a baby-safe mirror at his eye level so face-tracking motivates head lifts.",
          sourceLabel: "AAP HealthyChildren on tummy time",
          sourceUrl: U.tummyTime,
        },
        {
          body: "Read the same three to five board books on rotation; repetition supports recognition.",
        },
        {
          body: "Take conversational turns with each coo during calm-alert windows.",
          sourceLabel: "Romeo et al., Psych Science 2018",
          sourceUrl: U.romeo,
        },
      ],
      upcoming: [
        "Day 35-42: peak crying.",
        "Day 42: maternal 6-week postpartum visit.",
        "Day 56-70: 2-month well visit and first vaccines.",
      ],
    },
  },
  {
    ageInDays: 32,
    subject: "Day 32: evening fussiness peaks; rotation plan",
    citations: [
      "baby-kb/voice.md",
      "baby-kb/buckets/week-05.md",
      "baby-kb/topics/colic-and-crying.md",
    ],
    content: {
      ageInDays: 32,
      hook: "rotation matters",
      todaysFocus:
        "Day 32. Evening fussiness is climbing toward the week-six peak. A working rotation between adults — who is on the witching hour, who is on the night feed — is the difference between an exhausted week and an unsustainable one.",
      actionItems: [
        {
          body: "Agree explicitly on the evening rotation for the next two weeks. Write it on the fridge; do not negotiate at the moment of need.",
        },
        {
          body: "If Anoushka is breastfeeding, paced bottle feeding lets a second parent take an evening cycle without disrupting supply.",
        },
        {
          body: "Ask for an outside adult — relative, friend, postpartum doula — to cover one evening or one night this week. Both parents on at once is not always the answer.",
        },
        {
          body: "Schedule the 2-month well visit if not yet booked.",
          sourceLabel: "AAP Bright Futures periodicity",
          sourceUrl: U.brightFutures,
        },
        {
          body: "Continue the feeding log.",
        },
      ],
      watchFors: [
        "[low concern] Cluster fussiness in late afternoon and evening; smoother movements; social smiles.",
        "[low concern] Hiccups, wet sneezing, quiet startle to loud sounds.",
        "[monitor] Caregiver burnout signals — short fuse, intrusive thoughts, dread of the evening — say it out loud before the worst night.",
        "[call within 24h] Sustained feeding refusal. Forceful projectile vomiting. Bloody-mucus stool.",
        CALL_NOW,
      ],
      enrichment: [
        {
          body: "Tummy time 20-30 minutes a day across bouts.",
          sourceLabel: "AAP HealthyChildren on tummy time",
          sourceUrl: U.tummyTime,
        },
        {
          body: "5 S's sequence drilled during a calm period today so it is ready for the harder hours.",
          sourceLabel: "AAP HealthyChildren on crying and colic",
          sourceUrl: U.crying,
        },
        {
          body: "Outdoor walk in the stroller for 20-30 minutes most days.",
        },
        {
          body: "Take conversational turns with each vocalization in calm windows.",
          sourceLabel: "Romeo et al., Psych Science 2018",
          sourceUrl: U.romeo,
        },
      ],
      upcoming: [
        "Day 35-42: crying at peak intensity.",
        "Day 42: maternal 6-week postpartum visit.",
        "Day 56-70: 2-month well visit and first vaccines.",
      ],
    },
  },
  {
    ageInDays: 33,
    subject: "Day 33: head control improving; tummy time builds",
    citations: [
      "baby-kb/voice.md",
      "baby-kb/buckets/week-05.md",
      "baby-kb/topics/tummy-time-and-motor.md",
    ],
    content: {
      ageInDays: 33,
      hook: "head control consolidating",
      todaysFocus:
        "Day 33. Head lifts during tummy time can now reach 10-20 seconds at a stretch. Tracking is becoming wider; many infants follow objects 180 degrees across the visual field by week five.",
      actionItems: [
        {
          body: "Confirm the 2-month well visit is on the calendar (target day 56-70).",
          sourceLabel: "AAP Bright Futures periodicity",
          sourceUrl: U.brightFutures,
        },
        {
          body: "Verify Anoushka's 6-week postpartum OB visit is scheduled — about nine days from today.",
          sourceLabel: "ACOG on the postpartum period",
          sourceUrl: U.acogPostpartum,
        },
        {
          body: "If returning to work in 7-11 weeks, lock the daycare or nanny start date.",
          sourceLabel: "ChildCare.gov directory",
          sourceUrl: U.childcare,
        },
        {
          body: "Refill infant acetaminophen if low; the 2-month vaccine visit is approaching.",
          sourceLabel: "AAP HealthyChildren on fever",
          sourceUrl: U.fever,
        },
        {
          body: "Continue the feeding log.",
        },
      ],
      watchFors: [
        "[low concern] Sustained head lifts; tracking 180 degrees; social smiles; cluster fussiness in the evenings.",
        "[low concern] Hiccups; wet sneezing; quiet startle.",
        "[monitor] Forceful arching during or after feeds; persistent painful spit-up — raise at the next visit.",
        "[call within 24h] Sustained feeding refusal. Bloody-mucus stool. Fewer than six wet diapers per day.",
        CALL_NOW,
      ],
      enrichment: [
        {
          body: "Tummy time 20-30 minutes a day; vary positions across the floor, your chest at an incline, and the football-hold across your forearm.",
          sourceLabel: "AAP HealthyChildren on tummy time",
          sourceUrl: U.tummyTime,
        },
        {
          body: "Hold a high-contrast object 8-12 inches away and move it slowly through 180 degrees to encourage full visual tracking.",
        },
        {
          body: "Read aloud daily with intentional pauses for serve-and-return cadence.",
        },
        {
          body: "Live singing during diaper changes and bath time.",
        },
      ],
      upcoming: [
        "Day 35-42: peak crying.",
        "Day 42: maternal 6-week postpartum visit.",
        "Day 56-70: 2-month well visit and first vaccines.",
      ],
    },
  },
  {
    ageInDays: 34,
    subject: "Day 34: end of week 5; daycare deposits due",
    citations: [
      "baby-kb/voice.md",
      "baby-kb/buckets/week-05.md",
      "baby-kb/topics/childcare-options.md",
    ],
    content: {
      ageInDays: 34,
      hook: "end of week 5",
      todaysFocus:
        "Day 34. Closing out week five. Crying intensity is at or near peak; head control and social smiles are visibly improving. The next administrative cluster is the maternal postpartum visit and the 2-month well visit.",
      actionItems: [
        {
          body: "Pay any daycare waitlist or enrollment deposits this week so the spot does not move; reserve at the top of your shortlist.",
          sourceLabel: "ChildCare.gov directory",
          sourceUrl: U.childcare,
        },
        {
          body: "Pre-write questions for Anoushka's 6-week postpartum visit: pelvic floor recovery, mood and EPDS rescreen, return to exercise, contraception, breastfeeding plan, return-to-work date.",
          sourceLabel: "ACOG on postpartum birth control",
          sourceUrl: U.acogPpAptd,
        },
        {
          body: "Confirm the 2-month well visit is booked and the vaccine consent is understood (HepB #2, RV #1, DTaP #1, Hib #1, PCV #1, IPV #1).",
          sourceLabel: "AAP on immunizations",
          sourceUrl: U.vaccines,
        },
        {
          body: "Restock pantry and freezer for the peak-crying week ahead.",
        },
        {
          body: "Continue the feeding log.",
        },
      ],
      watchFors: [
        "[low concern] Peak evening fussiness; head control improving; smiles consolidating.",
        "[low concern] Quiet startle, hiccups, wet sneezing.",
        "[monitor] Forceful arching, painful spit-up, or feeding refusal — raise at the upcoming visit.",
        "[call within 24h] Sustained feeding refusal. Bloody-mucus stool. Fewer than six wet diapers per day.",
        CALL_NOW,
      ],
      enrichment: [
        {
          body: "Tummy time 20-30 minutes a day across bouts.",
          sourceLabel: "AAP HealthyChildren on tummy time",
          sourceUrl: U.tummyTime,
        },
        {
          body: "Hold him at a mirror at his eye level for 60-90 seconds during a calm window.",
        },
        {
          body: "Take conversational turns with every coo and squeal.",
          sourceLabel: "Romeo et al., Psych Science 2018",
          sourceUrl: U.romeo,
        },
        {
          body: "Outdoor stroller walk for 20-30 minutes most days.",
        },
      ],
      upcoming: [
        "Day 35-41: peak crying.",
        "Day 42: maternal 6-week postpartum visit.",
        "Day 56-70: 2-month well visit and first vaccines.",
      ],
    },
  },
  {
    ageInDays: 35,
    subject: "Day 35: week 6; maternal postpartum visit one week out",
    citations: [
      "baby-kb/voice.md",
      "baby-kb/buckets/week-06.md",
      "baby-kb/mom/postpartum-mood.md",
    ],
    content: {
      ageInDays: 35,
      hook: "week 6 opens",
      todaysFocus:
        "Day 35. Five weeks old; week six opens. Crying is at peak intensity for many infants. The maternal 6-week postpartum visit is a week from today — the most important non-baby appointment of this period.",
      actionItems: [
        {
          body: "Confirm Anoushka's 6-week postpartum OB visit is scheduled for around day 42.",
          sourceLabel: "ACOG on the postpartum period",
          sourceUrl: U.acogPostpartum,
        },
        {
          body: "Anoushka: complete a self-EPDS this week and bring the result to the visit; a score above 10 between visits warrants a message to the OB earlier.",
          sourceLabel: "Postpartum Support International",
          sourceUrl: U.ppsi,
        },
        {
          body: "Pre-write postpartum-visit questions: pelvic floor, mood, return to exercise, contraception, breastfeeding plan.",
          sourceLabel: "ACOG on postpartum birth control",
          sourceUrl: U.acogPpAptd,
        },
        {
          body: "Confirm the 2-month well visit is on the books.",
          sourceLabel: "AAP Bright Futures periodicity",
          sourceUrl: U.brightFutures,
        },
        {
          body: "Continue the feeding log.",
        },
      ],
      watchFors: [
        "[low concern] Peak evening fussiness; spontaneous social smiles; vowel coos consolidating; turn-taking during proto-conversations.",
        "[low concern] Hiccups during feeds; wet sneezing.",
        "[monitor] Persistent low mood, anxiety, or intrusive thoughts in Anoushka — these are the postpartum-OB conversation.",
        "[call within 24h] Cluster of poor feeding, lethargy, and decreased output. New murmur or blue color around the lips during feeds.",
        CALL_NOW,
      ],
      enrichment: [
        {
          body: "Tummy time 30 minutes a day cumulative; use a baby-safe mirror at his eye level.",
          sourceLabel: "AAP HealthyChildren on tummy time",
          sourceUrl: U.tummyTime,
        },
        {
          body: "Read aloud with intentional pauses — read a line, look at him, pause, read the next line.",
          sourceLabel: "Romeo et al., Psych Science 2018",
          sourceUrl: U.romeo,
        },
        {
          body: "Outdoor stroller walk for 20-30 minutes most days; vitamin D, cardiovascular recovery, varied input.",
          sourceLabel: "AAP HealthyChildren on vitamin D",
          sourceUrl: U.vitaminD,
        },
        {
          body: "Live singing during diaper changes and bath time.",
        },
      ],
      upcoming: [
        "Day 35-41: crying at peak intensity.",
        "Day 42: maternal 6-week postpartum visit.",
        "Day 56-70: 2-month well visit and first vaccines.",
      ],
    },
  },
  {
    ageInDays: 36,
    subject: "Day 36: EPDS rescreen; OB questions",
    citations: [
      "baby-kb/voice.md",
      "baby-kb/buckets/week-06.md",
      "baby-kb/mom/postpartum-mood.md",
    ],
    content: {
      ageInDays: 36,
      hook: "EPDS + OB prep",
      todaysFocus:
        "Day 36. The maternal 6-week postpartum visit is six days away. ACOG recommends an EPDS rescreen at this visit; doing it today lets Anoushka bring a recent number and a list of specifics, not a vague feeling.",
      actionItems: [
        {
          body: "Anoushka: take the EPDS self-screen today; a score of 13 or higher traditionally distinguishes likely depression and warrants direct conversation at the visit.",
          sourceLabel: "Postpartum Support International",
          sourceUrl: U.ppsi,
        },
        {
          body: "Write down OB-visit questions: pelvic-floor symptoms, mood and sleep, return to exercise, contraception, breastfeeding plan, return-to-work timing.",
          sourceLabel: "ACOG on postpartum birth control",
          sourceUrl: U.acogPpAptd,
        },
        {
          body: "If Anoushka will return to work and pump, confirm the pumping supplies arrived.",
        },
        {
          body: "Confirm the 2-month well visit is scheduled.",
          sourceLabel: "AAP Bright Futures periodicity",
          sourceUrl: U.brightFutures,
        },
        {
          body: "Continue the feeding log.",
        },
      ],
      watchFors: [
        "[low concern] Smiles spontaneously, especially at parents; vowel coos; vocal turn-taking.",
        "[low concern] Peak evening fussiness; quiet startle; hiccups.",
        "[monitor] Persistent low mood, anxiety, or intrusive thoughts in Anoushka — surface them at the visit; PPSI has 24/7 phone support if it is acute.",
        "[call within 24h] Maternal symptoms of postpartum hemorrhage: heavy bleeding, large clots, severe pain. Baby cluster of poor feeding + lethargy + decreased output.",
        CALL_NOW,
      ],
      enrichment: [
        {
          body: "Tummy time 30 minutes a day cumulative; rotate through floor, chest, and football-hold positions.",
          sourceLabel: "AAP HealthyChildren on tummy time",
          sourceUrl: U.tummyTime,
        },
        {
          body: "Take conversational turns with every vocalization during alert windows.",
          sourceLabel: "Romeo et al., Psych Science 2018",
          sourceUrl: U.romeo,
        },
        {
          body: "Read aloud daily with rhythmic, repetitive text.",
        },
        {
          body: "Live singing during bath time and diaper changes.",
        },
      ],
      upcoming: [
        "Day 42: maternal 6-week postpartum visit.",
        "Day 49: crying typically tapering noticeably.",
        "Day 56-70: 2-month well visit and first vaccines.",
      ],
    },
  },
  {
    ageInDays: 37,
    subject: "Day 37: peak-crying window; 5 S's revisited",
    citations: [
      "baby-kb/voice.md",
      "baby-kb/buckets/week-06.md",
      "baby-kb/topics/colic-and-crying.md",
    ],
    content: {
      ageInDays: 37,
      hook: "5 S's revisited",
      todaysFocus:
        "Day 37. The peak-crying curve is at or near its peak. The 5 S's sequence — swaddle, side or stomach hold (only while held and awake), shush, swing, suck — settles most infants when applied together rather than one at a time.",
      actionItems: [
        {
          body: "Drill the 5 S's together today during a calm period so the sequence is ready in the evening.",
          sourceLabel: "AAP HealthyChildren on crying and colic",
          sourceUrl: U.crying,
        },
        {
          body: "Confirm the rotation plan for the evening hours and the night feed.",
        },
        {
          body: "Anoushka's 6-week postpartum visit is five days away — confirm logistics (transportation, childcare during the visit).",
          sourceLabel: "ACOG on the postpartum period",
          sourceUrl: U.acogPostpartum,
        },
        {
          body: "If a feeding-related cause is suspected behind the worst crying (back arching, refusal, painful spit-up), message the pediatrician now rather than waiting for the next visit.",
        },
        {
          body: "Continue the feeding log.",
        },
      ],
      watchFors: [
        "[low concern] Pain-like facial expressions during crying that are not pain; evening cluster fussiness; spontaneous smiles between fussy windows.",
        "[low concern] Quiet startle to loud sounds; hiccups during or after feeds.",
        "[monitor] Sustained inability to console paired with feeding refusal or lethargy.",
        "[call within 24h] Bloody-mucus stool. Sustained feeding refusal. Inconsolable crying with high-pitched scream plus lethargy plus bulging fontanelle.",
        CALL_NOW,
      ],
      enrichment: [
        {
          body: "Tummy time 30 minutes a day cumulative; mirror at eye level when motivation lags.",
          sourceLabel: "AAP HealthyChildren on tummy time",
          sourceUrl: U.tummyTime,
        },
        {
          body: "Outdoor stroller walk for 20-30 minutes most days; motion settles many infants in this window.",
        },
        {
          body: "Take conversational turns with every coo during calm intervals.",
          sourceLabel: "Romeo et al., Psych Science 2018",
          sourceUrl: U.romeo,
        },
        {
          body: "Skin-to-skin holding after a hard evening cycle for both of you.",
        },
      ],
      upcoming: [
        "Day 42: maternal 6-week postpartum visit.",
        "Day 49: crying typically tapering noticeably.",
        "Day 56-70: 2-month well visit and first vaccines.",
      ],
    },
  },
  {
    ageInDays: 38,
    subject: "Day 38: tracks objects 180 degrees; visual milestone",
    citations: [
      "baby-kb/voice.md",
      "baby-kb/buckets/week-06.md",
      "baby-kb/topics/cognitive-development.md",
    ],
    content: {
      ageInDays: 38,
      hook: "visual tracking",
      todaysFocus:
        "Day 38. Visual tracking is approaching full 180 degrees. Eye contact during feeds is sustained. Vowel coos are consolidating and proto-conversations have a clearer back-and-forth rhythm.",
      actionItems: [
        {
          body: "Confirm Anoushka's postpartum visit is on the calendar for around day 42.",
          sourceLabel: "ACOG on the postpartum period",
          sourceUrl: U.acogPostpartum,
        },
        {
          body: "Confirm the 2-month well visit is booked (day 56-70).",
          sourceLabel: "AAP Bright Futures periodicity",
          sourceUrl: U.brightFutures,
        },
        {
          body: "Plan the post-vaccine 24-48-hour fussiness window into the schedule — the day of the 2-month visit is not a meeting-heavy day.",
          sourceLabel: "AAP HealthyChildren on fever",
          sourceUrl: U.fever,
        },
        {
          body: "Refill infant acetaminophen if not done.",
          sourceLabel: "AAP HealthyChildren on fever",
          sourceUrl: U.fever,
        },
        {
          body: "Continue the feeding log.",
        },
      ],
      watchFors: [
        "[low concern] Tracks objects 180 degrees; sustained social smiles; turn-taking vocalizations.",
        "[low concern] Hiccups during feeds; quiet startle.",
        "[monitor] No social smile yet by 8 weeks — flag at the 2-month visit but not concerning today.",
        "[call within 24h] Cluster of poor feeding plus lethargy plus decreased output. New murmur or blue color around the lips during feeds.",
        CALL_NOW,
      ],
      enrichment: [
        {
          body: "Slow visual-tracking exercises 8-12 inches from his face — pass an object through a full 180-degree arc.",
        },
        {
          body: "Tummy time 30 minutes a day cumulative.",
          sourceLabel: "AAP HealthyChildren on tummy time",
          sourceUrl: U.tummyTime,
        },
        {
          body: "Take conversational turns with each coo.",
          sourceLabel: "Romeo et al., Psych Science 2018",
          sourceUrl: U.romeo,
        },
        {
          body: "Read aloud daily; pause and look at him between lines for serve-and-return cadence.",
        },
      ],
      upcoming: [
        "Day 42: maternal 6-week postpartum visit.",
        "Day 49: crying tapering.",
        "Day 56-70: 2-month well visit and first vaccines.",
      ],
    },
  },
  {
    ageInDays: 39,
    subject: "Day 39: feeding cues sharper; satiety signals",
    citations: [
      "baby-kb/voice.md",
      "baby-kb/buckets/week-06.md",
      "baby-kb/topics/feeding-and-weight.md",
    ],
    content: {
      ageInDays: 39,
      hook: "feeding cues",
      todaysFocus:
        "Day 39. Hunger and satiety cues are sharper now: turning toward the breast or bottle, opening the mouth wide, settling visibly when full. Trust them — paced feeding works better than clock-based feeding at this age.",
      actionItems: [
        {
          body: "Confirm Anoushka's postpartum visit is on the calendar for around day 42.",
          sourceLabel: "ACOG on the postpartum period",
          sourceUrl: U.acogPostpartum,
        },
        {
          body: "If breastfeeding, look for a wide latch and audible swallowing as the reassuring signs; the feeding log captures duration and pattern.",
        },
        {
          body: "If formula or combo feeding, follow paced bottle feeding — let him pace the bottle, take breaks, stop when he turns away.",
        },
        {
          body: "Confirm vitamin D 400 IU/day is in place if breastfeeding exclusively or predominantly.",
          sourceLabel: "AAP HealthyChildren on vitamin D",
          sourceUrl: U.vitaminD,
        },
        {
          body: "Continue the feeding log.",
        },
      ],
      watchFors: [
        "[low concern] Visible satiety cues; sustained tracking; spontaneous smiles.",
        "[low concern] Hiccups during feeds; quiet startle.",
        "[monitor] Persistent painful spit-up, back arching, or refusal despite hunger cues — raise at the 2-month visit.",
        "[call within 24h] Sustained feeding refusal. Bloody-mucus stool. Fewer than six wet diapers per day.",
        CALL_NOW,
      ],
      enrichment: [
        {
          body: "Tummy time 30 minutes a day cumulative.",
          sourceLabel: "AAP HealthyChildren on tummy time",
          sourceUrl: U.tummyTime,
        },
        {
          body: "Take conversational turns with each vocalization in calm-alert windows.",
          sourceLabel: "Romeo et al., Psych Science 2018",
          sourceUrl: U.romeo,
        },
        {
          body: "Outdoor stroller walk for 20-30 minutes most days.",
        },
        {
          body: "Read aloud daily with rhythmic, repetitive text.",
        },
      ],
      upcoming: [
        "Day 42: maternal 6-week postpartum visit.",
        "Day 49: crying tapering.",
        "Day 56-70: 2-month well visit and first vaccines.",
      ],
    },
  },
  {
    ageInDays: 40,
    subject: "Day 40: vaccine fever plan; acetaminophen dosing",
    citations: [
      "baby-kb/voice.md",
      "baby-kb/buckets/week-06.md",
      "baby-kb/topics/vaccines-and-prevention.md",
    ],
    content: {
      ageInDays: 40,
      hook: "vaccine fever plan",
      todaysFocus:
        "Day 40. The 2-month vaccine visit is two to four weeks out. Most infants run a low-grade fever and 24-48 hours of fussiness after the shots. Today is the day to plan around that window and confirm dosing.",
      actionItems: [
        {
          body: "Confirm the 2-month well visit is booked; the vaccine list is HepB #2, RV #1, DTaP #1, Hib #1, PCV #1, IPV #1.",
          sourceLabel: "AAP on immunizations",
          sourceUrl: U.vaccines,
        },
        {
          body: "Confirm infant acetaminophen and a digital rectal thermometer are on hand; ask the pediatrician at the visit to write the exact dose for Avi's current weight.",
          sourceLabel: "AAP HealthyChildren on fever",
          sourceUrl: U.fever,
        },
        {
          body: "Block out the day of the visit and the day after — do not schedule meetings or social plans.",
        },
        {
          body: "Anoushka's postpartum visit is two days away — confirm logistics.",
          sourceLabel: "ACOG on the postpartum period",
          sourceUrl: U.acogPostpartum,
        },
        {
          body: "Continue the feeding log.",
        },
      ],
      watchFors: [
        "[low concern] Spontaneous smiles; tracking 180 degrees; vowel coos consolidating.",
        "[low concern] Crying intensity at or near peak; hiccups; quiet startle.",
        "[monitor] No social smile by week 8 — note for the 2-month visit but not concerning today.",
        "[call within 24h] Sustained feeding refusal. Bloody-mucus stool. New murmur or blue color around lips during feeds.",
        CALL_NOW,
      ],
      enrichment: [
        {
          body: "Tummy time 30 minutes a day cumulative.",
          sourceLabel: "AAP HealthyChildren on tummy time",
          sourceUrl: U.tummyTime,
        },
        {
          body: "Hold him at a mirror for 60-90 seconds at his eye level.",
        },
        {
          body: "Take conversational turns with each vocalization.",
          sourceLabel: "Romeo et al., Psych Science 2018",
          sourceUrl: U.romeo,
        },
        {
          body: "Outdoor stroller walk for 20-30 minutes.",
        },
      ],
      upcoming: [
        "Day 42: maternal 6-week postpartum visit.",
        "Day 49: crying tapering noticeably.",
        "Day 56-70: 2-month well visit and first vaccines.",
      ],
    },
  },
  {
    ageInDays: 41,
    subject: "Day 41: maternal 6-week postpartum visit tomorrow",
    citations: [
      "baby-kb/voice.md",
      "baby-kb/buckets/week-06.md",
      "baby-kb/mom/postpartum-mood.md",
    ],
    content: {
      ageInDays: 41,
      hook: "OB visit tomorrow",
      todaysFocus:
        "Day 41. Anoushka's 6-week postpartum visit is tomorrow. Today is for finalizing the question list, refreshing the EPDS, and packing what is needed for the visit.",
      actionItems: [
        {
          body: "Anoushka: refresh the EPDS today and bring the result. Pelvic-floor symptoms, mood, return to exercise, contraception, breastfeeding plan, return-to-work date are the typical agenda.",
          sourceLabel: "Postpartum Support International",
          sourceUrl: U.ppsi,
        },
        {
          body: "Confirm transportation and childcare during the visit; one parent attending alone is fine if the question list is clear.",
        },
        {
          body: "Pack the question list, the EPDS score, the breastfeeding plan, and the contraception preference.",
          sourceLabel: "ACOG on postpartum birth control",
          sourceUrl: U.acogPpAptd,
        },
        {
          body: "Confirm the 2-month well visit is booked.",
          sourceLabel: "AAP Bright Futures periodicity",
          sourceUrl: U.brightFutures,
        },
        {
          body: "Continue the feeding log.",
        },
      ],
      watchFors: [
        "[low concern] Spontaneous smiles; vowel coos; turn-taking; head control sustained 30-60 seconds.",
        "[low concern] Crying near peak intensity in the evenings.",
        "[monitor] Persistent low mood, anxiety, intrusive thoughts in Anoushka — say it at the visit explicitly.",
        "[call within 24h] Maternal heavy bleeding, large clots, or severe pain. Baby cluster of poor feeding plus lethargy plus decreased output.",
        CALL_NOW,
      ],
      enrichment: [
        {
          body: "Tummy time 30 minutes a day cumulative.",
          sourceLabel: "AAP HealthyChildren on tummy time",
          sourceUrl: U.tummyTime,
        },
        {
          body: "Outdoor walk for 20-30 minutes; useful for Anoushka the day before the visit.",
        },
        {
          body: "Take conversational turns with each coo.",
          sourceLabel: "Romeo et al., Psych Science 2018",
          sourceUrl: U.romeo,
        },
        {
          body: "Read aloud daily.",
        },
      ],
      upcoming: [
        "Day 42: maternal 6-week postpartum visit.",
        "Day 49: crying typically tapering noticeably.",
        "Day 56-70: 2-month well visit and first vaccines.",
      ],
    },
  },
  {
    ageInDays: 42,
    subject: "Day 42: six weeks; postpartum visit; crying begins to taper",
    citations: [
      "baby-kb/voice.md",
      "baby-kb/buckets/week-06.md",
      "baby-kb/mom/postpartum-mood.md",
    ],
    content: {
      ageInDays: 42,
      hook: "six weeks; postpartum visit",
      todaysFocus:
        "Day 42. Six weeks old. Anoushka's 6-week postpartum visit is today. The peak-crying curve is at its peak today or has just passed; many families describe this week as the first sustainable inflection.",
      actionItems: [
        {
          body: "Take the EPDS result and the question list to the postpartum visit; expect a discussion of pelvic floor, mood, exercise clearance, contraception, and breastfeeding.",
          sourceLabel: "ACOG on the postpartum period",
          sourceUrl: U.acogPostpartum,
        },
        {
          body: "If the OB clears exercise, start with walking and pelvic-floor work; running and impact wait one to two more weeks for most uncomplicated deliveries.",
        },
        {
          body: "Choose a contraception plan with the OB; lactational amenorrhea is unreliable as a sole method past six months and depends on exclusive breastfeeding.",
          sourceLabel: "ACOG on postpartum birth control",
          sourceUrl: U.acogPpAptd,
        },
        {
          body: "Confirm the 2-month well visit is booked.",
          sourceLabel: "AAP Bright Futures periodicity",
          sourceUrl: U.brightFutures,
        },
        {
          body: "Continue the feeding log.",
        },
      ],
      watchFors: [
        "[low concern] Spontaneous smiles to get attention; vowel coos consolidating; head control sustained 30-60 seconds.",
        "[low concern] Crying near peak intensity today; tapering begins this week or next for most infants.",
        "[monitor] No social smile by week 8 — note for the 2-month visit.",
        "[call within 24h] Maternal heavy bleeding, fever, or severe pelvic pain post-visit. Baby cluster of poor feeding plus lethargy plus decreased output.",
        CALL_NOW,
      ],
      enrichment: [
        {
          body: "Tummy time 30 minutes a day cumulative; baby-safe mirror at his eye level motivates head lifts.",
          sourceLabel: "AAP HealthyChildren on tummy time",
          sourceUrl: U.tummyTime,
        },
        {
          body: "Read aloud daily with intentional pauses for serve-and-return cadence.",
          sourceLabel: "Romeo et al., Psych Science 2018",
          sourceUrl: U.romeo,
        },
        {
          body: "Outdoor stroller walk for 20-30 minutes; varied input for him, cardiovascular recovery for you.",
          sourceLabel: "AAP HealthyChildren on vitamin D",
          sourceUrl: U.vitaminD,
        },
        {
          body: "Live singing during routines.",
        },
      ],
      upcoming: [
        "Day 49: crying typically tapering noticeably.",
        "Day 56-70: 2-month well visit and first vaccines.",
        "Day 70-84: post-vaccine 24-48-hour fussiness window.",
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
  console.log(`\n${DAYS.length} artifacts written.`);

  // Auto-bake the milestone check-in. The bake step is required to keep
  // the validator happy and the morning send correct.
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
