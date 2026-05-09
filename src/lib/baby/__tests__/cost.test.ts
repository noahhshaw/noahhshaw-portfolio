import { describe, it, expect } from "vitest";
import { estimateCost } from "../classifier";

describe("estimateCost", () => {
  it("zero usage costs $0", () => {
    expect(
      estimateCost({
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
      })
    ).toBe("0.000000");
  });

  it("computes Sonnet 4.6 input + output pricing correctly", () => {
    // 1M input @ $3 + 1M output @ $15 = $18
    const cost = estimateCost({
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
    });
    expect(Number(cost)).toBeCloseTo(18, 2);
  });

  it("cache reads are ~10x cheaper than fresh input", () => {
    const fresh = Number(
      estimateCost({
        inputTokens: 100_000,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
      })
    );
    const cached = Number(
      estimateCost({
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 100_000,
        cacheCreationTokens: 0,
      })
    );
    // $0.30 per MTok (cache read) vs $3.00 per MTok (fresh input).
    expect(fresh / cached).toBeCloseTo(10, 1);
  });

  it("a typical reply call (heavy cache) costs less than a cent", () => {
    // ~30k tokens of voice guide + KB context, served from cache after
    // first call; ~500 fresh input tokens (the user's reply); ~600 output.
    const cost = Number(
      estimateCost({
        inputTokens: 500,
        outputTokens: 600,
        cacheReadTokens: 30_000,
        cacheCreationTokens: 0,
      })
    );
    expect(cost).toBeLessThan(0.02);
  });

  it("first call (cache creation) is more expensive than subsequent calls", () => {
    const first = Number(
      estimateCost({
        inputTokens: 500,
        outputTokens: 600,
        cacheReadTokens: 0,
        cacheCreationTokens: 30_000,
      })
    );
    const subsequent = Number(
      estimateCost({
        inputTokens: 500,
        outputTokens: 600,
        cacheReadTokens: 30_000,
        cacheCreationTokens: 0,
      })
    );
    expect(first).toBeGreaterThan(subsequent);
  });

  it("returns a fixed-precision string with 6 decimals", () => {
    const cost = estimateCost({
      inputTokens: 1234,
      outputTokens: 567,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
    });
    expect(cost).toMatch(/^\d+\.\d{6}$/);
  });
});
