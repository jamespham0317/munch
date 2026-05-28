import { describe, expect, it } from "vitest";

import { isUnanimousLike } from "./matching";

describe("isUnanimousLike", () => {
  it("returns true when every present member has liked the restaurant", () => {
    expect(
      isUnanimousLike({
        presentMemberIds: ["m1", "m2", "m3"],
        likerMemberIds: ["m1", "m2", "m3"],
      }),
    ).toBe(true);
  });

  it("returns false when the present cohort is empty (no vacuous match)", () => {
    expect(
      isUnanimousLike({
        presentMemberIds: [],
        likerMemberIds: ["m1", "m2"],
      }),
    ).toBe(false);
  });

  it("returns true for a single present member who liked", () => {
    expect(
      isUnanimousLike({
        presentMemberIds: ["m1"],
        likerMemberIds: ["m1"],
      }),
    ).toBe(true);
  });

  it("flips to unanimous when the non-liker leaves mid-session", () => {
    const likers = ["m1", "m2"];
    expect(
      isUnanimousLike({
        presentMemberIds: ["m1", "m2", "m3"],
        likerMemberIds: likers,
      }),
    ).toBe(false);
    expect(
      isUnanimousLike({
        presentMemberIds: ["m1", "m2"],
        likerMemberIds: likers,
      }),
    ).toBe(true);
  });
});
