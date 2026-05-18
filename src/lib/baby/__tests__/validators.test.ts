import { describe, it, expect } from "vitest";
import { validateEmail } from "../validators";

const goodEmail = {
  ageInDays: 7,
  subject: "Day 7: schedule first-week visit",
  citations: [
    "baby-kb/voice.md",
    "baby-kb/buckets/week-02.md",
  ],
  bodyText: [
    "Today's focus",
    "Day 7. Weight-regain window opens.",
    "",
    "Action items",
    "- Schedule the first-week visit (target day 7-10).",
    "- Apply for the SSN if not yet filed.",
    "- Add the baby to your health insurance plan within 30 days.",
    "- Order another 4-6 weeks of postpartum supplies.",
    "- Begin a feeding log if breastfeeding.",
    "",
    "Watch-fors",
    "- [low concern] Cord stump drying and detaching between days 5-15.",
    "- [monitor] Yellow tinge persisting despite phototherapy.",
    "- [call within 24h] Redness greater than 1 cm around the umbilical stump.",
    "- [call now] Rectal temperature at or above 100.4F.",
    "",
    "Enrichment opportunities",
    "- Narrate one ordinary task during his next awake-alert window.",
    "- Hold him 8-12 inches away and let him track your face side to side.",
    "- Lay him skin-to-skin on your chest after a feed.",
    "",
    "Upcoming",
    "- Day 7-10: first-week pediatrician visit.",
  ].join("\n"),
  bodyHtml: "<p>...</p><p>External links only here.</p>",
};

describe("validateEmail", () => {
  it("clean email has no issues", () => {
    // Padded with filler to clear the 200-word minimum.
    const padded = {
      ...goodEmail,
      bodyText: goodEmail.bodyText + "\n\n" + Array(150).fill("word").join(" "),
    };
    expect(validateEmail(padded)).toEqual([]);
  });

  it("flags wrong subject prefix", () => {
    const issues = validateEmail({ ...goodEmail, subject: "Hello there" });
    expect(issues.some((i) => i.includes("Day 7:"))).toBe(true);
  });

  it("flags subject over 72 chars", () => {
    const issues = validateEmail({
      ...goodEmail,
      subject:
        "Day 7: " + "very ".repeat(20) + "long subject line that exceeds limit",
    });
    expect(issues.some((i) => i.includes("subject too long"))).toBe(true);
  });

  it("flags banned phrases in body", () => {
    const issues = validateEmail({
      ...goodEmail,
      bodyText: goodEmail.bodyText.replace(
        "Day 7. Weight-regain",
        "What a precious little one. Day 7. Weight-regain"
      ),
    });
    expect(issues.some((i) => i.includes("banned phrase"))).toBe(true);
  });

  it("flags emoji in body", () => {
    const issues = validateEmail({
      ...goodEmail,
      bodyText: "🎉\n" + goodEmail.bodyText,
    });
    expect(issues.some((i) => i.includes("emoji"))).toBe(true);
  });

  it("allows exclamation only inside [call now] lines", () => {
    const allowed = validateEmail({
      ...goodEmail,
      bodyText: goodEmail.bodyText.replace(
        "[call now] Rectal temperature at or above 100.4F.",
        "[call now] Bluish lips, labored breathing — call 911!"
      ),
    });
    expect(allowed.some((i) => i.includes("exclamation"))).toBe(false);

    const flagged = validateEmail({
      ...goodEmail,
      bodyText: goodEmail.bodyText.replace(
        "Day 7. Weight-regain window opens.",
        "Day 7! Weight-regain window opens!"
      ),
    });
    expect(flagged.some((i) => i.includes("exclamation"))).toBe(true);
  });

  it("flags missing required sections", () => {
    const stripped = goodEmail.bodyText.replace(
      "Watch-fors",
      "(removed-section)"
    );
    const issues = validateEmail({ ...goodEmail, bodyText: stripped });
    expect(issues.some((i) => i.includes("Watch-fors"))).toBe(true);
  });

  it("flags Anushka misspelling in body", () => {
    const issues = validateEmail({
      ...goodEmail,
      bodyText: goodEmail.bodyText.replace(
        "his next awake-alert",
        "Anushka's next awake-alert"
      ),
    });
    expect(issues.some((i) => i.toLowerCase().includes("anoushka"))).toBe(true);
  });

  it("flags baby-kb path leak in body", () => {
    const issues = validateEmail({
      ...goodEmail,
      bodyText:
        goodEmail.bodyText +
        "\n\nSee baby-kb/topics/sleep-newborn-fundamentals.md for more.",
    });
    expect(issues.some((i) => i.includes("baby-kb/"))).toBe(true);
  });

  it("flags Enrichment opportunities with fewer than 3 bullets", () => {
    const stripped = goodEmail.bodyText
      .replace(
        "- Hold him 8-12 inches away and let him track your face side to side.\n",
        ""
      )
      .replace("- Lay him skin-to-skin on your chest after a feed.\n", "");
    const issues = validateEmail({ ...goodEmail, bodyText: stripped });
    expect(
      issues.some((i) => i.includes("Enrichment opportunities must have at least 3"))
    ).toBe(true);
  });

  it("flags Enrichment opportunities with more than 5 bullets", () => {
    const extra = goodEmail.bodyText.replace(
      "- Lay him skin-to-skin on your chest after a feed.",
      [
        "- Lay him skin-to-skin on your chest after a feed.",
        "- Play soft music during a calm-alert window.",
        "- Read aloud from any book — the cadence is what matters.",
        "- Let him grasp your finger and feel different textures.",
      ].join("\n")
    );
    const issues = validateEmail({ ...goodEmail, bodyText: extra });
    expect(
      issues.some((i) => i.includes("Enrichment opportunities must have at most 5"))
    ).toBe(true);
  });

  it("flags missing Enrichment opportunities section", () => {
    const stripped = goodEmail.bodyText.replace(
      /Enrichment opportunities[\s\S]*?\n\nUpcoming/,
      "Upcoming"
    );
    const issues = validateEmail({ ...goodEmail, bodyText: stripped });
    expect(
      issues.some((i) => i.includes("missing section: Enrichment opportunities"))
    ).toBe(true);
  });

  it("flags non-baby-kb citations", () => {
    const issues = validateEmail({
      ...goodEmail,
      citations: ["Emily Oster, Cribsheet"],
    });
    expect(issues.some((i) => i.includes("baby-kb/"))).toBe(true);
  });

  it("flags missing citations", () => {
    const issues = validateEmail({ ...goodEmail, citations: [] });
    expect(issues.some((i) => i.includes("no citations"))).toBe(true);
  });
});
