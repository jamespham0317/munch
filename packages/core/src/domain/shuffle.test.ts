import { describe, expect, it } from "vitest";

import { shuffleDeck } from "./shuffle";

const deck = Array.from({ length: 24 }, (_, i) => i);

describe("shuffleDeck", () => {
  it("is deterministic: the same seed yields the same order", () => {
    const a = shuffleDeck(deck, {
      memberId: "member-1",
      sessionId: "session-1",
    });
    const b = shuffleDeck(deck, {
      memberId: "member-1",
      sessionId: "session-1",
    });
    expect(a).toEqual(b);
  });

  it("yields a different order for a different member in the same session", () => {
    const a = shuffleDeck(deck, {
      memberId: "member-1",
      sessionId: "session-1",
    });
    const b = shuffleDeck(deck, {
      memberId: "member-2",
      sessionId: "session-1",
    });
    expect(a).not.toEqual(b);
  });

  it("yields a different order for the same member in a different session", () => {
    const a = shuffleDeck(deck, {
      memberId: "member-1",
      sessionId: "session-1",
    });
    const b = shuffleDeck(deck, {
      memberId: "member-1",
      sessionId: "session-2",
    });
    expect(a).not.toEqual(b);
  });

  it("is a permutation of the input (no loss or duplication)", () => {
    const shuffled = shuffleDeck(deck, {
      memberId: "member-1",
      sessionId: "session-1",
    });
    expect(shuffled).toHaveLength(deck.length);
    expect([...shuffled].sort((x, y) => x - y)).toEqual(deck);
  });

  it("does not mutate the input array", () => {
    const input = [...deck];
    shuffleDeck(input, { memberId: "member-1", sessionId: "session-1" });
    expect(input).toEqual(deck);
  });
});
