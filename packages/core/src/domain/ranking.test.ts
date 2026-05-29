import { describe, expect, it } from "vitest";

import {
  rankByClosestToUnanimous,
  type ResolutionRankingEntry,
} from "./ranking";

const entry = (
  overrides: Partial<ResolutionRankingEntry> & { restaurantId: string },
): ResolutionRankingEntry => ({
  passCount: 0,
  rating: null,
  distanceM: 0,
  ...overrides,
});

describe("rankByClosestToUnanimous", () => {
  it("orders by fewest passes — NOT by raw like count", () => {
    // The 1-pass entry must outrank the 3-pass entry even though the function
    // is given no like counts at all: closeness-to-unanimous is pass-count, not likes.
    const ranked = rankByClosestToUnanimous([
      entry({ restaurantId: "three-passes", passCount: 3 }),
      entry({ restaurantId: "one-pass", passCount: 1 }),
      entry({ restaurantId: "two-passes", passCount: 2 }),
    ]);
    expect(ranked.map((e) => e.restaurantId)).toEqual([
      "one-pass",
      "two-passes",
      "three-passes",
    ]);
  });

  it("breaks a tie on passes by higher rating", () => {
    const ranked = rankByClosestToUnanimous([
      entry({ restaurantId: "lower", passCount: 1, rating: 3.5 }),
      entry({ restaurantId: "higher", passCount: 1, rating: 4.5 }),
    ]);
    expect(ranked.map((e) => e.restaurantId)).toEqual(["higher", "lower"]);
  });

  it("breaks a tie on passes AND rating by nearer distance", () => {
    const ranked = rankByClosestToUnanimous([
      entry({
        restaurantId: "far",
        passCount: 1,
        rating: 4.0,
        distanceM: 2000,
      }),
      entry({
        restaurantId: "near",
        passCount: 1,
        rating: 4.0,
        distanceM: 500,
      }),
    ]);
    expect(ranked.map((e) => e.restaurantId)).toEqual(["near", "far"]);
  });

  it("sorts a null rating below any numeric rating at the same pass count", () => {
    const ranked = rankByClosestToUnanimous([
      entry({ restaurantId: "null-rating", passCount: 1, rating: null }),
      entry({ restaurantId: "rated", passCount: 1, rating: 1.0 }),
    ]);
    expect(ranked.map((e) => e.restaurantId)).toEqual(["rated", "null-rating"]);
  });

  it("does not mutate the input array (purity)", () => {
    const input: ResolutionRankingEntry[] = [
      entry({ restaurantId: "b", passCount: 2 }),
      entry({ restaurantId: "a", passCount: 1 }),
    ];
    const snapshot = [...input];
    rankByClosestToUnanimous(input);
    expect(input).toEqual(snapshot);
    expect(input.map((e) => e.restaurantId)).toEqual(["b", "a"]);
  });

  it("is deterministic for all-equal input", () => {
    const input = [
      entry({ restaurantId: "x", passCount: 1, rating: 4.0, distanceM: 100 }),
      entry({ restaurantId: "y", passCount: 1, rating: 4.0, distanceM: 100 }),
      entry({ restaurantId: "z", passCount: 1, rating: 4.0, distanceM: 100 }),
    ];
    const first = rankByClosestToUnanimous(input).map((e) => e.restaurantId);
    const second = rankByClosestToUnanimous(input).map((e) => e.restaurantId);
    expect(first).toEqual(second);
  });
});
