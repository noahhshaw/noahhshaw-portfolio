/* eslint-disable no-console */
/**
 * Author + render days 25-42 (18 daily artifacts) — a diversity-focused
 * regeneration of the next two weeks of sends (today is day 24, 2026-06-04).
 *
 * Why this exists separate from regenerate-days-24-42.ts:
 *   The 2026-05-21 batch repeated nearly the same four enrichment bullets
 *   (tummy time + read aloud + conversational turns + walk) and the same
 *   five watch-for lines every day, which dampened novel insight. This
 *   pass:
 *     - Rotates a much wider enrichment pool across motor, visual, language,
 *       music, sensory/outdoor, and reading domains so no two consecutive
 *       days repeat and no single day is five variations of one activity.
 *     - Adds idea-generation / planning bullets the parents asked for:
 *       parent-baby swim-class waitlists, Music Together / Suzuki listening,
 *       carrier walks outside, blanket-on-grass sensory windows, high-contrast
 *       mobiles, board-book rotations, and low-stimulation SF outings.
 *     - Varies the watch-for lines day to day (keeping the [call now] safety
 *       line constant by design — restating hard thresholds is intentional).
 *
 * Auto-bakes the milestone check-in at the end. Forward completed/skipped
 * milestone keys to the bake step with --exclude so the parents stop seeing
 * items they already marked:
 *
 *   npx tsx scripts/regenerate-days-25-42.ts --exclude=brief-head-lift,calms-with-soothing
 *
 * Then confirm with: npm run precompute:validate
 */
import { promises as fs } from "fs";
import { resolve } from "path";
import { spawnSync } from "child_process";
import { renderDaily, type DailyContent } from "@/lib/baby/render-daily";

const GENERATED_AT = "2026-06-04T18:00:00Z";
const KB_VERSION = "2026-06-04-diverse";

// All URLs below were HEAD/GET-probed with a browser UA and returned 2xx.
// Keep this table the single source for inline authority links so the link
// checker stays green; swap here if a page moves.
const U = {
  brightFutures:
    "https://www.aap.org/en/practice-management/bright-futures/bright-futures-tools-and-resources/",
  tummyTime:
    "https://www.healthychildren.org/English/ages-stages/baby/sleep/Pages/Back-to-Sleep-Tummy-to-Play.aspx",
  movement:
    "https://www.healthychildren.org/English/ages-stages/baby/Pages/Movement-Birth-to-Three-Months.aspx",
  babySenses:
    "https://www.healthychildren.org/English/ages-stages/baby/Pages/default.aspx",
  crying:
    "https://www.healthychildren.org/English/ages-stages/baby/crying-colic/Pages/default.aspx",
  fever:
    "https://www.healthychildren.org/English/health-issues/conditions/fever/Pages/default.aspx",
  firstMonth:
    "https://www.healthychildren.org/English/ages-stages/baby/Pages/default.aspx",
  vitaminD:
    "https://www.healthychildren.org/English/healthy-living/nutrition/Pages/Vitamin-D-On-the-Double.aspx",
  swim: "https://www.healthychildren.org/English/safety-prevention/at-play/Pages/Swim-Lessons.aspx",
  romeo: "https://pubmed.ncbi.nlm.nih.gov/29442613/",
  musicStudy: "https://pubmed.ncbi.nlm.nih.gov/22490184/",
  musicTogether: "https://www.musictogether.com/",
  suzuki: "https://suzukiassociation.org/",
  reachOutRead: "https://reachoutandread.org/",
  earlyLiteracy: "https://www.aap.org/en/patient-care/early-childhood/early-literacy/",
  calAcademy: "https://www.calacademy.org/",
  vaccines:
    "https://www.aap.org/en/patient-care/immunizations/aap-policy-on-immunizations/",
  acogPostpartum:
    "https://www.acog.org/womens-health/faqs/postpartum-pain-management",
  acogPpAptd:
    "https://www.acog.org/womens-health/faqs/postpartum-birth-control",
  ppsi: "https://www.postpartum.net/",
  childcare: "https://www.childcare.gov/",
  carecom: "https://www.care.com/",
  qle: "https://www.healthcare.gov/glossary/qualifying-life-event/",
};

// Restating hard safety thresholds across days is intentional (voice.md
// "Repetition"). The [call now] line stays constant by design.
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
    ageInDays: 25,
    subject: "Day 25: 1-month visit window opens; bring the feeding log",
    citations: [
      "baby-kb/voice.md",
      "baby-kb/buckets/week-04.md",
      "baby-kb/topics/reading-aloud.md",
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
          body: "Continue daycare tours and waitlist deposits if returning to work in 9-13 weeks.",
          sourceLabel: "ChildCare.gov directory",
          sourceUrl: U.childcare,
        },
      ],
      watchFors: [
        "[low concern] Cradle cap on the scalp; a blocked tear duct (continuous tearing in one eye, no redness); brief head lifts during tummy time.",
        "[low concern] Early cooing and the first reflex-versus-social smiles during alert windows.",
        "[monitor] Crying trending past three hours a day on more than three days a week — the colic pattern, which peaks at six to eight weeks.",
        "[call within 24h] Forceful projectile vomiting with weight loss, or fewer than six wet diapers in 24 hours.",
        CALL_NOW,
      ],
      enrichment: [
        {
          body: "Read aloud 15 minutes during the morning wake window; high-contrast board books (Tana Hoban's Black on White) hold a one-month-old's attention best.",
          sourceLabel: "Reach Out and Read evidence base",
          sourceUrl: U.reachOutRead,
        },
        {
          body: "Set up a black-white-red high-contrast mobile 8-12 inches above the play mat; the visual cortex still prefers high contrast at this age.",
          sourceLabel: "AAP HealthyChildren on infant senses",
          sourceUrl: U.babySenses,
        },
        {
          body: "Tummy time 15-20 minutes a day across short post-feed bouts; use a chest incline if floor time fatigues him.",
          sourceLabel: "AAP HealthyChildren on tummy time",
          sourceUrl: U.tummyTime,
        },
        {
          body: "Take a 20-30 minute stroller walk in daylight; morning light helps entrain his circadian rhythm.",
          sourceLabel: "AAP HealthyChildren on vitamin D and sunlight",
          sourceUrl: U.vitaminD,
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
      "baby-kb/topics/language-exposure.md",
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
          body: "If returning to work soon, confirm the daycare or nanny start date matches the return date with a 1-2 week buffer.",
          sourceLabel: "ChildCare.gov directory",
          sourceUrl: U.childcare,
        },
      ],
      watchFors: [
        "[low concern] First vowel coos (ah, ooh) and quieting to a familiar voice; sustained eye contact during feeds.",
        "[low concern] Hiccups during or after feeds; wet sneezing; quiet startle to loud sounds.",
        "[monitor] Forceful arching during or after feeds, or painful spit-up despite hunger cues — possible reflux or cow's-milk-protein intolerance; note it for the next visit.",
        "[call within 24h] Bloody-mucus stool, or persistent inability to console paired with back-arching during feeds.",
        CALL_NOW,
      ],
      enrichment: [
        {
          body: "Take conversational turns with every coo — respond as if he spoke, pause, then answer his next sound. Turn-taking, not raw word count, predicts later language scores.",
          sourceLabel: "Romeo et al., Psych Science 2018",
          sourceUrl: U.romeo,
        },
        {
          body: "Sing live during diaper changes; vary it day to day — a lullaby, then something rhythmic. Participation, not pitch, is the active ingredient.",
          sourceLabel: "Gerry, Unrau, Trainor, Dev Sci 2012",
          sourceUrl: U.musicStudy,
        },
        {
          body: "Tummy time near 20 minutes a day; the football hold across your forearm is a useful variation when floor time stalls.",
          sourceLabel: "AAP HealthyChildren on tummy time",
          sourceUrl: U.tummyTime,
        },
        {
          body: "Wear him in a carrier for a short walk outside during a calm window; keep his chin off his chest and his face visible.",
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
    subject: "Day 27: end of week 4; plan the enrichment pipeline",
    citations: [
      "baby-kb/voice.md",
      "baby-kb/buckets/week-04.md",
      "baby-kb/dad/activity-pipeline.md",
    ],
    content: {
      ageInDays: 27,
      hook: "end of week 4",
      todaysFocus:
        "Day 27. End of week four. Feeding cadence is stable and the first social smile may already have appeared. Tomorrow opens the peak-crying weeks — a good moment to line up the enrichment and care pipeline before the harder evenings arrive.",
      actionItems: [
        {
          body: "If the 1-month visit is still pending, confirm or schedule it today.",
          sourceLabel: "AAP Bright Futures periodicity",
          sourceUrl: U.brightFutures,
        },
        {
          body: "Read up on the peak-crying curve before the peak so the coming evenings feel expected, not alarming.",
          sourceLabel: "AAP HealthyChildren on crying and colic",
          sourceUrl: U.crying,
        },
        {
          body: "Lock daycare or nanny start dates; coordinate a 1-2 week overlap with paid leave if possible.",
          sourceLabel: "ChildCare.gov directory",
          sourceUrl: U.childcare,
        },
        {
          body: "Order pumping supplies if Anoushka will pump after returning to work; the double-electric pump is typically covered by insurance under the ACA.",
        },
      ],
      watchFors: [
        "[low concern] Smoother, more symmetric arm and leg movements; first social smiles; evening fussiness starting to build toward the witching hour.",
        "[low concern] Cradle cap; a blocked tear duct without redness.",
        "[monitor] Persistent low mood or anxiety in Anoushka — the EPDS rescreen is one to two weeks out at the postpartum visit.",
        "[call within 24h] Forceful projectile vomiting with weight loss, or fewer than six wet diapers per day.",
        CALL_NOW,
      ],
      enrichment: [
        {
          body: "Research a Bay Area parent-baby swim class and join a waitlist now; many SF programs start at three to six months and fill early.",
          sourceLabel: "AAP HealthyChildren on swim lessons",
          sourceUrl: U.swim,
        },
        {
          body: "Lay him on a blanket on the grass in shade for a few minutes of new tactile and visual input; end before any sign of overstimulation.",
          sourceLabel: "AAP HealthyChildren on infant senses",
          sourceUrl: U.babySenses,
        },
        {
          body: "Read aloud daily; start a rotation of three to five board books so the repetition builds rhythm and predictability.",
          sourceLabel: "Reach Out and Read evidence base",
          sourceUrl: U.reachOutRead,
        },
        {
          body: "Tummy time 20 minutes a day, building toward the 30-minute week-six target.",
          sourceLabel: "AAP HealthyChildren on tummy time",
          sourceUrl: U.tummyTime,
        },
      ],
      upcoming: [
        "Day 28-35: peak-crying curve begins.",
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
      "baby-kb/topics/music-and-suzuki.md",
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
          body: "Read about the 5 S's (swaddle, side hold, shush, swing, suck) so you have a settling sequence ready for hard nights.",
          sourceLabel: "AAP HealthyChildren on crying and colic",
          sourceUrl: U.crying,
        },
        {
          body: "Pre-schedule the 2-month well visit for day 56-70 if not yet done; vaccines will include HepB, RV, DTaP, Hib, PCV, and IPV.",
          sourceLabel: "AAP on immunizations",
          sourceUrl: U.vaccines,
        },
        {
          body: "Run active daycare or nanny interviews if returning to work in 7-11 weeks.",
          sourceLabel: "Care.com",
          sourceUrl: U.carecom,
        },
      ],
      watchFors: [
        "[low concern] Inconsolable evening crying with no clear cause — peak crying is normal and clusters at this age. Hiccups during feeds; wet sneezing.",
        "[low concern] More sustained head lifts in tummy time; brief tracking across the visual field; social smiles.",
        "[monitor] Forceful arching during or after feeds, painful spit-up, or feeding refusal despite hunger cues — possible GERD or cow's-milk-protein intolerance; raise at the next visit.",
        "[call within 24h] Bloody-mucus stool (possible CMPI or anal fissure), or sustained refusal of feeds.",
        CALL_NOW,
      ],
      enrichment: [
        {
          body: "Enroll in or waitlist a Music Together class near you; live group music from around six weeks is the highest-evidence music intervention for prelinguistic gains.",
          sourceLabel: "Music Together",
          sourceUrl: U.musicTogether,
        },
        {
          body: "Hold a high-contrast card 8-12 inches away and move it slowly through 180 degrees to draw out visual tracking.",
          sourceLabel: "AAP HealthyChildren on movement, birth to three months",
          sourceUrl: U.movement,
        },
        {
          body: "Face-to-face talking with slow, exaggerated expressions — the most reliable way to elicit an early social smile.",
          sourceLabel: "AAP HealthyChildren on infant senses",
          sourceUrl: U.babySenses,
        },
        {
          body: "Tummy time 20-30 minutes a day cumulative across short bouts.",
          sourceLabel: "AAP HealthyChildren on tummy time",
          sourceUrl: U.tummyTime,
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
      "baby-kb/topics/sleep-newborn-fundamentals.md",
    ],
    content: {
      ageInDays: 29,
      hook: "peak crying primer",
      todaysFocus:
        "Day 29. The peak-crying pattern: unexpected episodes, resistant to soothing, pain-like faces that are not pain, long duration, clustered in the evenings. It peaks at about six weeks and tapers by three to four months. Recognizing the pattern is half the recovery.",
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
      ],
      watchFors: [
        "[low concern] Evening cluster fussiness; pain-like facial expressions during crying that are NOT pain.",
        "[low concern] Hiccups and wet sneezing; a quiet startle to loud sounds.",
        "[monitor] If you ever feel the urge to shake him, put him down safely in the crib, step away for ten minutes, and call your partner or a friend — peak crying coincides with peak shaken-baby risk.",
        "[call within 24h] Bloody-mucus stool; sustained feeding refusal; persistent inconsolability paired with lethargy or fever.",
        CALL_NOW,
      ],
      enrichment: [
        {
          body: "Practice the 5 S's during a calm period so the sequence is ready for the harder hours: swaddle, side or stomach hold (only while held and awake), shush, swing, suck.",
          sourceLabel: "AAP HealthyChildren on crying and colic",
          sourceUrl: U.crying,
        },
        {
          body: "Take a carrier walk outside; the motion and fresh air settle many infants during the witching hour.",
        },
        {
          body: "Sing live during bath time, varying the harmonic vocabulary day to day — a folk tune one evening, a simple classical melody the next.",
          sourceLabel: "Gerry, Unrau, Trainor, Dev Sci 2012",
          sourceUrl: U.musicStudy,
        },
        {
          body: "Tummy time 20-30 minutes a day across short bouts.",
          sourceLabel: "AAP HealthyChildren on tummy time",
          sourceUrl: U.tummyTime,
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
    subject: "Day 30: one month; firm up the help network",
    citations: [
      "baby-kb/voice.md",
      "baby-kb/buckets/week-05.md",
      "baby-kb/topics/reading-aloud.md",
    ],
    content: {
      ageInDays: 30,
      hook: "one month in",
      todaysFocus:
        "Day 30. One month. Feeding cadence is steady, social smiles are appearing more reliably, and head control is visibly stronger. With the harder weeks ahead, this is the right day to firm up the help network rather than improvise it later.",
      actionItems: [
        {
          body: "List the two or three people you can call at 2am for an extra set of hands — a relative, a postpartum doula, a close friend. Confirm each is willing and reachable.",
        },
        {
          body: "Write the evening-rotation plan on the fridge so it is not renegotiated at the moment of need.",
        },
        {
          body: "Verify Avi is on the health-insurance plan and the member number is accessible from your phone.",
          sourceLabel: "Healthcare.gov on qualifying life events",
          sourceUrl: U.qle,
        },
        {
          body: "Confirm the 2-month well visit is scheduled.",
          sourceLabel: "AAP Bright Futures periodicity",
          sourceUrl: U.brightFutures,
        },
      ],
      watchFors: [
        "[low concern] Evening cluster fussiness; hiccups during or after feeds; a quiet startle to loud sounds.",
        "[low concern] Brief head lifts during tummy time; social smiles consolidating.",
        "[monitor] Caregiver burnout signals — a short fuse, dread of the evenings, persistent low mood — name them out loud before the worst night.",
        "[call within 24h] Sustained feeding refusal; forceful projectile vomiting; fewer than six wet diapers per day.",
        CALL_NOW,
      ],
      enrichment: [
        {
          body: "Read aloud 15 minutes a day; aim toward the 1,000-books-before-kindergarten frame — about one book a day from now gets you there.",
          sourceLabel: "Reach Out and Read evidence base",
          sourceUrl: U.reachOutRead,
        },
        {
          body: "Plan a low-stimulation SF outing for a calm morning — an early stroller loop through the SF Botanical Garden or the California Academy of Sciences before crowds build.",
          sourceLabel: "California Academy of Sciences",
          sourceUrl: U.calAcademy,
        },
        {
          body: "Tummy time 20-30 minutes a day across multiple bouts; a baby-safe mirror at eye level motivates head lifts.",
          sourceLabel: "AAP HealthyChildren on tummy time",
          sourceUrl: U.tummyTime,
        },
        {
          body: "Take conversational turns with each vocalization during alert windows.",
          sourceLabel: "Romeo et al., Psych Science 2018",
          sourceUrl: U.romeo,
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
    subject: "Day 31: logistics close-out; decide the music plan",
    citations: [
      "baby-kb/voice.md",
      "baby-kb/buckets/week-05.md",
      "baby-kb/topics/music-and-suzuki.md",
    ],
    content: {
      ageInDays: 31,
      hook: "logistics calibration",
      todaysFocus:
        "Day 31. Feeding rhythm is steady, evenings are getting harder, and the back half of parental leave is in view. A good day to close the last logistics loops and make the early enrichment decisions that have long lead times.",
      actionItems: [
        {
          body: "Order pumping supplies through Anoushka's insurer if pumping after return to work; the double-electric pump is typically covered under the ACA.",
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
          body: "Plan a paternity-to-maternity leave overlap if both parents are still home; cluster crying is easier on two adults.",
        },
      ],
      watchFors: [
        "[low concern] Evening cluster fussiness building; social smiles emerging; head control improving.",
        "[low concern] A quiet startle and hiccups during or after feeds.",
        "[monitor] Forceful arching during feeds or refusal despite hunger cues — possible reflux or CMPI; raise at the next visit.",
        "[call within 24h] Sustained feeding refusal; bloody-mucus stool; fewer than six wet diapers per day.",
        CALL_NOW,
      ],
      enrichment: [
        {
          body: "If you plan early instrument lessons, decide the instrument by six to nine months and order the Suzuki Book 1 listening recordings to play during calm times.",
          sourceLabel: "Suzuki Association of the Americas",
          sourceUrl: U.suzuki,
        },
        {
          body: "Rotate his outlook: alternate which side of the changing area faces the window so he tracks light and faces from both directions — this also helps even head shape.",
          sourceLabel: "AAP HealthyChildren on tummy time and head shape",
          sourceUrl: U.tummyTime,
        },
        {
          body: "Take a daylight stroller or carrier walk for 20-30 minutes.",
          sourceLabel: "AAP HealthyChildren on vitamin D and sunlight",
          sourceUrl: U.vitaminD,
        },
        {
          body: "Tummy time 20-30 minutes a day; a baby-safe mirror motivates head lifts.",
          sourceLabel: "AAP HealthyChildren on tummy time",
          sourceUrl: U.tummyTime,
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
    subject: "Day 32: evening fussiness climbs; rotation plan",
    citations: [
      "baby-kb/voice.md",
      "baby-kb/buckets/week-05.md",
      "baby-kb/topics/language-exposure.md",
    ],
    content: {
      ageInDays: 32,
      hook: "rotation matters",
      todaysFocus:
        "Day 32. Evening fussiness is climbing toward the week-six peak. A working rotation between adults — who is on the witching hour, who is on the night feed — is the difference between an exhausting week and an unsustainable one.",
      actionItems: [
        {
          body: "Agree explicitly on the evening rotation for the next two weeks. Write it down; do not negotiate at the moment of need.",
        },
        {
          body: "If Anoushka is breastfeeding, paced bottle feeding lets a second parent take an evening cycle without disrupting supply.",
        },
        {
          body: "Ask an outside adult — relative, friend, postpartum doula — to cover one evening or one night this week.",
        },
        {
          body: "Schedule the 2-month well visit if not yet booked.",
          sourceLabel: "AAP Bright Futures periodicity",
          sourceUrl: U.brightFutures,
        },
      ],
      watchFors: [
        "[low concern] Cluster fussiness in late afternoon and evening; smoother, more symmetric movements; social smiles.",
        "[low concern] Hiccups, wet sneezing, and a quiet startle to loud sounds.",
        "[monitor] Caregiver burnout — a short fuse, intrusive thoughts, dread of the evening — say it out loud before the worst night.",
        "[call within 24h] Sustained feeding refusal; forceful projectile vomiting; bloody-mucus stool.",
        CALL_NOW,
      ],
      enrichment: [
        {
          body: "Narrate one ordinary task end to end — making coffee, folding laundry — in full sentences during an awake-alert window.",
          sourceLabel: "Romeo et al., Psych Science 2018",
          sourceUrl: U.romeo,
        },
        {
          body: "Lay him on a blanket on the grass in shade for a few minutes of tactile and outdoor-light input; stop before he fusses.",
          sourceLabel: "AAP HealthyChildren on infant senses",
          sourceUrl: U.babySenses,
        },
        {
          body: "Read aloud on rotation; pause and look at him between lines so the reading has a serve-and-return rhythm.",
          sourceLabel: "Reach Out and Read evidence base",
          sourceUrl: U.reachOutRead,
        },
        {
          body: "Tummy time 20-30 minutes a day across bouts.",
          sourceLabel: "AAP HealthyChildren on tummy time",
          sourceUrl: U.tummyTime,
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
    subject: "Day 33: head control improving; visual tracking widens",
    citations: [
      "baby-kb/voice.md",
      "baby-kb/buckets/week-05.md",
      "baby-kb/topics/tummy-time-and-motor.md",
    ],
    content: {
      ageInDays: 33,
      hook: "head control consolidating",
      todaysFocus:
        "Day 33. Head lifts during tummy time can now reach 10-20 seconds at a stretch. Tracking is widening; many infants follow objects across most of the visual field by week five.",
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
      ],
      watchFors: [
        "[low concern] Sustained head lifts; wider visual tracking; social smiles; cluster fussiness in the evenings.",
        "[low concern] Hiccups; wet sneezing; a quiet startle.",
        "[monitor] A head tilt that always turns the same way, or a flat spot developing — reposition and raise it at the next visit if it persists.",
        "[call within 24h] Sustained feeding refusal; bloody-mucus stool; fewer than six wet diapers per day.",
        CALL_NOW,
      ],
      enrichment: [
        {
          body: "Pass a high-contrast object slowly through a full 180-degree arc 8-12 inches from his face to encourage wide visual tracking.",
          sourceLabel: "AAP HealthyChildren on movement, birth to three months",
          sourceUrl: U.movement,
        },
        {
          body: "Sing the same short song at the same daily moment — bath, first wake — so predictable live music supports pattern recognition.",
          sourceLabel: "Gerry, Unrau, Trainor, Dev Sci 2012",
          sourceUrl: U.musicStudy,
        },
        {
          body: "Tummy time 20-30 minutes a day; vary floor, chest-incline, and forearm football-hold positions.",
          sourceLabel: "AAP HealthyChildren on tummy time",
          sourceUrl: U.tummyTime,
        },
        {
          body: "Take a carrier walk outside; keep his face visible and his airway clear with his chin off his chest.",
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
      "baby-kb/dad/activity-pipeline.md",
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
          body: "Pre-write questions for Anoushka's 6-week postpartum visit: pelvic-floor recovery, mood and EPDS rescreen, return to exercise, contraception, breastfeeding plan, return-to-work date.",
          sourceLabel: "ACOG on postpartum birth control",
          sourceUrl: U.acogPpAptd,
        },
        {
          body: "Confirm the 2-month well visit is booked and the vaccine list is understood (HepB #2, RV #1, DTaP #1, Hib #1, PCV #1, IPV #1).",
          sourceLabel: "AAP on immunizations",
          sourceUrl: U.vaccines,
        },
        {
          body: "Restock the pantry and freezer for the peak-crying week ahead.",
        },
      ],
      watchFors: [
        "[low concern] Peak evening fussiness; head control improving; smiles consolidating.",
        "[low concern] A quiet startle, hiccups, and wet sneezing.",
        "[monitor] Forceful arching, painful spit-up, or feeding refusal — raise it at the upcoming visit.",
        "[call within 24h] Sustained feeding refusal; bloody-mucus stool; fewer than six wet diapers per day.",
        CALL_NOW,
      ],
      enrichment: [
        {
          body: "Confirm your parent-baby swim waitlist spot and note the start age; most Bay Area classes begin at three to six months.",
          sourceLabel: "AAP HealthyChildren on swim lessons",
          sourceUrl: U.swim,
        },
        {
          body: "Read aloud 15 minutes; add one new high-contrast title to the rotation to keep his attention fresh.",
          sourceLabel: "Reach Out and Read evidence base",
          sourceUrl: U.reachOutRead,
        },
        {
          body: "Take a morning daylight walk for 20-30 minutes to reinforce his day-night rhythm.",
          sourceLabel: "AAP HealthyChildren on vitamin D and sunlight",
          sourceUrl: U.vitaminD,
        },
        {
          body: "Tummy time 20-30 minutes a day across bouts.",
          sourceLabel: "AAP HealthyChildren on tummy time",
          sourceUrl: U.tummyTime,
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
      "baby-kb/mom/ppd-watch-fors.md",
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
          body: "Anoushka: complete a self-EPDS this week and bring the result; a score above 10 between visits warrants a message to the OB earlier.",
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
      ],
      watchFors: [
        "[low concern] Peak evening fussiness; spontaneous social smiles; vowel coos consolidating; turn-taking in proto-conversations.",
        "[low concern] Hiccups during feeds; wet sneezing.",
        "[monitor] Persistent low mood, anxiety, or intrusive thoughts in Anoushka — these are the postpartum-OB conversation; PPSI has 24/7 support if it feels acute.",
        "[call within 24h] A cluster of poor feeding, lethargy, and decreased output; a new murmur or blue color around the lips during feeds.",
        CALL_NOW,
      ],
      enrichment: [
        {
          body: "Attend or schedule a first Music Together (or Kindermusik) class; live participatory music beats recorded for prelinguistic communication gains.",
          sourceLabel: "Music Together",
          sourceUrl: U.musicTogether,
        },
        {
          body: "Swap a fresh high-contrast card into the mobile or his eye-line; sustained novelty holds his lengthening attention.",
          sourceLabel: "AAP HealthyChildren on infant senses",
          sourceUrl: U.babySenses,
        },
        {
          body: "Take conversational turns during proto-conversations — he is beginning to answer with coos.",
          sourceLabel: "Romeo et al., Psych Science 2018",
          sourceUrl: U.romeo,
        },
        {
          body: "Take a daylight stroller walk for 20-30 minutes.",
          sourceLabel: "AAP HealthyChildren on vitamin D and sunlight",
          sourceUrl: U.vitaminD,
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
      "baby-kb/mom/ppd-watch-fors.md",
    ],
    content: {
      ageInDays: 36,
      hook: "EPDS + OB prep",
      todaysFocus:
        "Day 36. The maternal 6-week postpartum visit is six days away. ACOG recommends an EPDS rescreen at this visit; doing it today lets Anoushka bring a recent number and a list of specifics, not a vague feeling.",
      actionItems: [
        {
          body: "Anoushka: take the EPDS self-screen today; a score of 13 or higher traditionally distinguishes likely depression and warrants a direct conversation at the visit.",
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
      ],
      watchFors: [
        "[low concern] Smiles spontaneously, especially at parents; vowel coos; vocal turn-taking.",
        "[low concern] Peak evening fussiness; a quiet startle; hiccups.",
        "[monitor] Persistent low mood, anxiety, or intrusive thoughts in Anoushka — surface them at the visit; PPSI has 24/7 phone support if it is acute.",
        "[call within 24h] Maternal postpartum-hemorrhage signs: heavy bleeding, large clots, severe pain. For the baby: a cluster of poor feeding, lethargy, and decreased output.",
        CALL_NOW,
      ],
      enrichment: [
        {
          body: "Read with intentional pauses — read a line, look at him, wait, read the next; this serve-and-return cadence is active even pre-verbally.",
          sourceLabel: "AAP on early literacy",
          sourceUrl: U.earlyLiteracy,
        },
        {
          body: "Lay him on a blanket on the grass for a short sensory window; describe what he sees and hears as you go.",
          sourceLabel: "AAP HealthyChildren on infant senses",
          sourceUrl: U.babySenses,
        },
        {
          body: "Tummy time 30 minutes a day cumulative; rotate floor, chest, and football-hold positions.",
          sourceLabel: "AAP HealthyChildren on tummy time",
          sourceUrl: U.tummyTime,
        },
        {
          body: "Sing live during diaper changes and bath.",
          sourceLabel: "Gerry, Unrau, Trainor, Dev Sci 2012",
          sourceUrl: U.musicStudy,
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
      "baby-kb/topics/sleep-newborn-fundamentals.md",
    ],
    content: {
      ageInDays: 37,
      hook: "5 S's revisited",
      todaysFocus:
        "Day 37. The crying curve is at or near its peak. The 5 S's — swaddle, side or stomach hold (only while held and awake), shush, swing, suck — settle most infants when applied together rather than one at a time.",
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
          body: "If a feeding cause is suspected behind the worst crying (back arching, refusal, painful spit-up), message the pediatrician now rather than waiting.",
        },
      ],
      watchFors: [
        "[low concern] Pain-like facial expressions during crying that are not pain; evening cluster fussiness; spontaneous smiles between fussy windows.",
        "[low concern] A quiet startle to loud sounds; hiccups during or after feeds.",
        "[monitor] If the evenings push either parent to the edge, hand the baby off or set him down safely and step away — peak crying coincides with peak shaken-baby risk.",
        "[call within 24h] Bloody-mucus stool; sustained feeding refusal; inconsolable high-pitched screaming with lethargy and a bulging fontanelle.",
        CALL_NOW,
      ],
      enrichment: [
        {
          body: "Take a carrier walk outside during the fussy evening window; motion plus fresh air settles many infants.",
        },
        {
          body: "Hold him skin-to-skin after a hard cycle — it supports regulation for him and for you.",
          sourceLabel: "AAP HealthyChildren on infant senses",
          sourceUrl: U.babySenses,
        },
        {
          body: "Run a slow visual-tracking pass 8-12 inches from his face through 180 degrees during a calm-alert moment.",
          sourceLabel: "AAP HealthyChildren on movement, birth to three months",
          sourceUrl: U.movement,
        },
        {
          body: "Read aloud daily even on hard days; the rhythm of your voice is the active ingredient.",
          sourceLabel: "Reach Out and Read evidence base",
          sourceUrl: U.reachOutRead,
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
      "baby-kb/dad/activity-pipeline.md",
    ],
    content: {
      ageInDays: 38,
      hook: "visual tracking",
      todaysFocus:
        "Day 38. Visual tracking is approaching a full 180 degrees and eye contact during feeds is sustained. Vowel coos are consolidating and proto-conversations have a clearer back-and-forth rhythm.",
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
          body: "Plan the post-vaccine 24-48 hour fussiness window into the schedule — the day of the 2-month visit should not be meeting-heavy.",
          sourceLabel: "AAP HealthyChildren on fever",
          sourceUrl: U.fever,
        },
        {
          body: "Refill infant acetaminophen if not done.",
          sourceLabel: "AAP HealthyChildren on fever",
          sourceUrl: U.fever,
        },
      ],
      watchFors: [
        "[low concern] Tracks objects through nearly 180 degrees; sustained social smiles; turn-taking vocalizations.",
        "[low concern] Hiccups during feeds; a quiet startle.",
        "[monitor] No social smile yet by eight weeks — flag at the 2-month visit, but it is not concerning today.",
        "[call within 24h] A cluster of poor feeding, lethargy, and decreased output; a new murmur or blue color around the lips during feeds.",
        CALL_NOW,
      ],
      enrichment: [
        {
          body: "Pass an object through a full 180-degree arc; he can nearly follow the whole sweep now.",
          sourceLabel: "AAP HealthyChildren on movement, birth to three months",
          sourceUrl: U.movement,
        },
        {
          body: "Plan a quiet SF outing on a calm day — an early stroller visit to the California Academy of Sciences or a shaded Golden Gate Park loop before crowds build.",
          sourceLabel: "California Academy of Sciences",
          sourceUrl: U.calAcademy,
        },
        {
          body: "Take conversational turns with each coo during alert windows.",
          sourceLabel: "Romeo et al., Psych Science 2018",
          sourceUrl: U.romeo,
        },
        {
          body: "Tummy time 30 minutes a day cumulative.",
          sourceLabel: "AAP HealthyChildren on tummy time",
          sourceUrl: U.tummyTime,
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
      "baby-kb/topics/music-and-suzuki.md",
    ],
    content: {
      ageInDays: 39,
      hook: "feeding cues",
      todaysFocus:
        "Day 39. Hunger and satiety cues are sharper now: turning toward the breast or bottle, opening the mouth wide, settling visibly when full. Paced feeding works better than clock-based feeding at this age.",
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
          body: "If formula or combo feeding, follow paced bottle feeding — let him pace, take breaks, stop when he turns away.",
        },
        {
          body: "Confirm vitamin D 400 IU/day is in place if breastfeeding exclusively or predominantly.",
          sourceLabel: "AAP HealthyChildren on vitamin D",
          sourceUrl: U.vitaminD,
        },
      ],
      watchFors: [
        "[low concern] Visible satiety cues; sustained tracking; spontaneous smiles.",
        "[low concern] Hiccups during feeds; a quiet startle.",
        "[monitor] Persistent painful spit-up, back arching, or refusal despite hunger cues — raise at the 2-month visit.",
        "[call within 24h] Sustained feeding refusal; bloody-mucus stool; fewer than six wet diapers per day.",
        CALL_NOW,
      ],
      enrichment: [
        {
          body: "Sing a varied repertoire across the day — a lullaby, a folk tune, something with a different rhythm — to widen his harmonic exposure.",
          sourceLabel: "Gerry, Unrau, Trainor, Dev Sci 2012",
          sourceUrl: U.musicStudy,
        },
        {
          body: "Read aloud on rotation; he may quiet to the familiar cadence of repeated books.",
          sourceLabel: "Reach Out and Read evidence base",
          sourceUrl: U.reachOutRead,
        },
        {
          body: "Take a daylight stroller or carrier walk for 20-30 minutes.",
          sourceLabel: "AAP HealthyChildren on vitamin D and sunlight",
          sourceUrl: U.vitaminD,
        },
        {
          body: "Tummy time 30 minutes a day cumulative.",
          sourceLabel: "AAP HealthyChildren on tummy time",
          sourceUrl: U.tummyTime,
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
      "baby-kb/topics/vaccines-overview.md",
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
          body: "Confirm infant acetaminophen and a digital rectal thermometer are on hand; ask the pediatrician to write the exact dose for Avi's current weight at the visit.",
          sourceLabel: "AAP HealthyChildren on fever",
          sourceUrl: U.fever,
        },
        {
          body: "Block out the day of the visit and the day after — no meetings or social plans.",
        },
        {
          body: "Anoushka's postpartum visit is two days away — confirm logistics.",
          sourceLabel: "ACOG on the postpartum period",
          sourceUrl: U.acogPostpartum,
        },
      ],
      watchFors: [
        "[low concern] Spontaneous smiles; tracking through nearly 180 degrees; vowel coos consolidating.",
        "[low concern] Crying intensity at or near peak; hiccups; a quiet startle.",
        "[monitor] No social smile by week eight — note it for the 2-month visit, but it is not concerning today.",
        "[call within 24h] Sustained feeding refusal; bloody-mucus stool; a new murmur or blue color around the lips during feeds.",
        CALL_NOW,
      ],
      enrichment: [
        {
          body: "Swap a fresh high-contrast card into his eye-line; novelty sustains his lengthening visual attention.",
          sourceLabel: "AAP HealthyChildren on infant senses",
          sourceUrl: U.babySenses,
        },
        {
          body: "If music lessons are in the plan, play the Suzuki listening recordings for your chosen instrument during calm times.",
          sourceLabel: "Suzuki Association of the Americas",
          sourceUrl: U.suzuki,
        },
        {
          body: "Narrate an ordinary task in full sentences during an alert window.",
          sourceLabel: "Romeo et al., Psych Science 2018",
          sourceUrl: U.romeo,
        },
        {
          body: "Tummy time 30 minutes a day cumulative.",
          sourceLabel: "AAP HealthyChildren on tummy time",
          sourceUrl: U.tummyTime,
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
      "baby-kb/mom/postpartum-physical-recovery.md",
    ],
    content: {
      ageInDays: 41,
      hook: "OB visit tomorrow",
      todaysFocus:
        "Day 41. Anoushka's 6-week postpartum visit is tomorrow. Today is for finalizing the question list, refreshing the EPDS, and packing what the visit needs.",
      actionItems: [
        {
          body: "Anoushka: refresh the EPDS today and bring the result. Pelvic-floor symptoms, mood, return to exercise, contraception, breastfeeding plan, and return-to-work date are the typical agenda.",
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
      ],
      watchFors: [
        "[low concern] Spontaneous smiles; vowel coos; turn-taking; head control sustained 30-60 seconds.",
        "[low concern] Crying near peak intensity in the evenings.",
        "[monitor] Persistent low mood, anxiety, or intrusive thoughts in Anoushka — say it at the visit explicitly.",
        "[call within 24h] Maternal heavy bleeding, large clots, or severe pain. For the baby: a cluster of poor feeding, lethargy, and decreased output.",
        CALL_NOW,
      ],
      enrichment: [
        {
          body: "Read aloud 15 minutes in a calm window.",
          sourceLabel: "Reach Out and Read evidence base",
          sourceUrl: U.reachOutRead,
        },
        {
          body: "Lay him on a blanket on the grass for a few minutes of outdoor sensory input while you get some fresh air before tomorrow's visit.",
          sourceLabel: "AAP HealthyChildren on infant senses",
          sourceUrl: U.babySenses,
        },
        {
          body: "Sing live during a routine; participation over performance.",
          sourceLabel: "Gerry, Unrau, Trainor, Dev Sci 2012",
          sourceUrl: U.musicStudy,
        },
        {
          body: "Take conversational turns with each vocalization.",
          sourceLabel: "Romeo et al., Psych Science 2018",
          sourceUrl: U.romeo,
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
      "baby-kb/mom/postpartum-physical-recovery.md",
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
      ],
      watchFors: [
        "[low concern] Spontaneous smiles to get attention; vowel coos consolidating; head control sustained 30-60 seconds.",
        "[low concern] Crying near peak intensity today; tapering begins this week or next for most infants.",
        "[monitor] No social smile by week eight — note it for the 2-month visit.",
        "[call within 24h] Maternal heavy bleeding, fever, or severe pelvic pain after the visit. For the baby: a cluster of poor feeding, lethargy, and decreased output.",
        CALL_NOW,
      ],
      enrichment: [
        {
          body: "Take a daylight stroller walk — varied input for him, cardiovascular recovery for Anoushka after the visit.",
          sourceLabel: "AAP HealthyChildren on vitamin D and sunlight",
          sourceUrl: U.vitaminD,
        },
        {
          body: "Read aloud with serve-and-return pauses — a line, a look, a wait, the next line.",
          sourceLabel: "AAP on early literacy",
          sourceUrl: U.earlyLiteracy,
        },
        {
          body: "Lock in a weekly live-music class (Music Together or similar) now that you are six weeks in.",
          sourceLabel: "Music Together",
          sourceUrl: U.musicTogether,
        },
        {
          body: "Tummy time 30 minutes a day cumulative; a baby-safe mirror at eye level motivates head lifts.",
          sourceLabel: "AAP HealthyChildren on tummy time",
          sourceUrl: U.tummyTime,
        },
      ],
      upcoming: [
        "Day 49: crying typically tapering noticeably.",
        "Day 56-70: 2-month well visit and first vaccines.",
        "Day 70-84: post-vaccine 24-48 hour fussiness window.",
      ],
    },
  },
];

async function main() {
  const excludeArg = process.argv
    .slice(2)
    .find((a) => a.startsWith("--exclude=") || a.startsWith("--exclude-file="));

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

  // Auto-bake the milestone check-in. Pass --exclude through to drop the
  // milestones the parents have already marked complete or skipped.
  const lo = Math.min(...DAYS.map((d) => d.ageInDays));
  const hi = Math.max(...DAYS.map((d) => d.ageInDays));
  const bakeArgs = ["run", "milestones:bake", "--", `--days=${lo}-${hi}`];
  if (excludeArg) bakeArgs.push(excludeArg);
  console.log(
    `\nBaking milestone check-in into days ${lo}-${hi}` +
      (excludeArg ? ` (${excludeArg})` : "") +
      "…"
  );
  const r = spawnSync("npm", bakeArgs, { stdio: "inherit" });
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
