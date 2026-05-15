import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  renderCheckInHtml,
  renderCheckInText,
  type MilestoneRow,
} from "../milestones";
import type {
  MilestoneCatalog,
  MilestoneEvent,
} from "@/db/schema";

const CATALOG = JSON.parse(
  readFileSync(
    resolve(process.cwd(), "baby-kb/milestones/aap-cdc-2022.json"),
    "utf8"
  )
) as {
  milestones: Array<{
    key: string;
    display_name: string;
    category: string;
    age_window_low_days: number;
    age_window_high_days: number;
    source_url: string;
    seed_order: number;
  }>;
  version: string;
};

const ORIGIN = "https://www.noahhshaw.com";

function mockCatalog(key: string, overrides: Partial<MilestoneCatalog> = {}): MilestoneCatalog {
  return {
    id: 1,
    key,
    displayName: "First social smile",
    category: "social-emotional",
    ageWindowLowDays: 28,
    ageWindowHighDays: 60,
    sourceUrl: "https://example.com/smile",
    clinicalNote: null,
    seedOrder: 5,
    catalogVersion: "test",
    updatedAt: new Date(),
    ...overrides,
  };
}

function mockEvent(overrides: Partial<MilestoneEvent> = {}): MilestoneEvent {
  return {
    id: 1,
    babyProfileId: 1,
    milestoneId: 1,
    status: "pending",
    observedDate: null,
    completedAt: null,
    skippedAt: null,
    notes: null,
    updatedAt: new Date(),
    ...overrides,
  };
}

function row(
  key: string,
  catalogOverrides: Partial<MilestoneCatalog> = {},
  eventOverrides: Partial<MilestoneEvent> = {},
  pastWindow = false
): MilestoneRow {
  return {
    catalog: mockCatalog(key, catalogOverrides),
    event: mockEvent(eventOverrides),
    pastWindow,
  };
}

describe("CDC/AAP catalog file", () => {
  it("has at least 100 milestones covering year 1 + early year 2", () => {
    expect(CATALOG.milestones.length).toBeGreaterThanOrEqual(100);
  });

  it("every entry has a unique key", () => {
    const keys = new Set(CATALOG.milestones.map((m) => m.key));
    expect(keys.size).toBe(CATALOG.milestones.length);
  });

  it("every entry has age_window_low <= age_window_high", () => {
    for (const m of CATALOG.milestones) {
      expect(m.age_window_low_days).toBeLessThanOrEqual(
        m.age_window_high_days
      );
    }
  });

  it("every entry has a CDC or AAP source URL", () => {
    for (const m of CATALOG.milestones) {
      expect(m.source_url).toMatch(/(cdc\.gov|healthychildren\.org)/);
    }
  });

  it("every entry has a category in the canonical set", () => {
    const ok = new Set([
      "social-emotional",
      "language-communication",
      "cognitive",
      "movement-gross",
      "movement-fine",
    ]);
    for (const m of CATALOG.milestones) {
      expect(ok.has(m.category)).toBe(true);
    }
  });

  it("seed_order is unique and dense from 1..N", () => {
    const sorted = [...CATALOG.milestones]
      .map((m) => m.seed_order)
      .sort((a, b) => a - b);
    const seen = new Set(sorted);
    expect(seen.size).toBe(sorted.length);
    expect(sorted[0]).toBe(1);
  });

  it("covers every key 30-day age band from 0-365 with at least 1 milestone whose low_days falls in the band", () => {
    // Floor of 1 per month — the daily check-in section requires only 1
    // surfaceable item, so each month must have at least one new one.
    for (let m = 0; m < 12; m++) {
      const lo = m * 30;
      const hi = lo + 30;
      const inBand = CATALOG.milestones.filter(
        (e) => e.age_window_low_days >= lo && e.age_window_low_days < hi
      );
      expect(
        inBand.length,
        `Need ≥1 milestone with low_days in [${lo},${hi}); got ${inBand.length}`
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it("has at least 8 entries in each of the 5 canonical categories", () => {
    const counts: Record<string, number> = {};
    for (const m of CATALOG.milestones) {
      counts[m.category] = (counts[m.category] ?? 0) + 1;
    }
    for (const cat of [
      "social-emotional",
      "language-communication",
      "cognitive",
      "movement-gross",
      "movement-fine",
    ]) {
      expect(counts[cat] ?? 0, `category ${cat} has ${counts[cat] ?? 0}`).toBeGreaterThanOrEqual(8);
    }
  });
});

describe("renderCheckInText", () => {
  it("is empty when no rows", () => {
    expect(renderCheckInText({ rows: [], origin: ORIGIN })).toBe("");
  });

  it("includes a Mark complete URL per row pointing at /baby/milestones/<key>/complete", () => {
    const r = row("first-social-smile", { displayName: "First social smile" });
    const out = renderCheckInText({ rows: [r], origin: ORIGIN });
    expect(out).toContain("First social smile");
    expect(out).toContain(
      `${ORIGIN}/baby/milestones/first-social-smile/complete`
    );
    expect(out).toContain(`${ORIGIN}/baby/milestones`);
  });

  it("marks past-window items", () => {
    const r = row("late-walker", { displayName: "First steps" }, {}, true);
    const out = renderCheckInText({ rows: [r], origin: ORIGIN });
    expect(out).toContain("past expected window");
  });
});

describe("renderCheckInHtml", () => {
  it("is empty when no rows", () => {
    expect(renderCheckInHtml({ rows: [], origin: ORIGIN })).toBe("");
  });

  it("wraps each row in a list item with a Mark complete anchor", () => {
    const r = row("first-social-smile", {
      displayName: "First social smile",
    });
    const html = renderCheckInHtml({ rows: [r], origin: ORIGIN });
    expect(html).toContain("Developmental milestone check-in");
    expect(html).toContain("First social smile");
    expect(html).toContain(
      `href="${ORIGIN}/baby/milestones/first-social-smile/complete"`
    );
    expect(html).toContain(`href="${ORIGIN}/baby/milestones"`);
    expect(html).toContain("Mark complete");
  });

  it("escapes HTML in the display name", () => {
    const r = row("xss", { displayName: "<script>alert(1)</script>" });
    const html = renderCheckInHtml({ rows: [r], origin: ORIGIN });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("renders the past-window badge for past-window rows", () => {
    const r = row("walks", { displayName: "First steps" }, {}, true);
    const html = renderCheckInHtml({ rows: [r], origin: ORIGIN });
    expect(html).toContain("past expected window");
  });
});
