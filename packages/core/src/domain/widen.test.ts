import { describe, expect, it } from "vitest";

import {
  isNonNarrowingWiden,
  setFilterIsBroaderOrEqual,
  type WidenSnapshot,
} from "./widen";

describe("setFilterIsBroaderOrEqual", () => {
  it("requested empty ('any') is always broader-or-equal", () => {
    expect(setFilterIsBroaderOrEqual([], [])).toBe(true);
    expect(setFilterIsBroaderOrEqual(["italian"], [])).toBe(true);
    expect(setFilterIsBroaderOrEqual(["italian", "thai"], [])).toBe(true);
  });

  it("restricting an unrestricted (empty) session set narrows", () => {
    expect(setFilterIsBroaderOrEqual([], ["italian"])).toBe(false);
  });

  it("a superset of the session set broadens-or-equals", () => {
    expect(setFilterIsBroaderOrEqual(["italian"], ["italian"])).toBe(true);
    expect(setFilterIsBroaderOrEqual(["italian"], ["italian", "thai"])).toBe(
      true,
    );
  });

  it("dropping a session value narrows", () => {
    expect(setFilterIsBroaderOrEqual(["italian", "thai"], ["italian"])).toBe(
      false,
    );
    // Swapping one value for another is still a narrow (drops a member).
    expect(setFilterIsBroaderOrEqual(["italian"], ["thai"])).toBe(false);
  });

  it("ignores order and duplicates", () => {
    expect(
      setFilterIsBroaderOrEqual(["italian", "thai"], ["thai", "italian"]),
    ).toBe(true);
    expect(
      setFilterIsBroaderOrEqual(["italian"], ["italian", "italian", "thai"]),
    ).toBe(true);
  });
});

describe("isNonNarrowingWiden", () => {
  const base: WidenSnapshot = {
    radiusM: 3000,
    openNow: true,
    cuisines: ["italian"],
    priceLevels: ["2"],
  };

  it("an identical request is non-narrowing (no-op widen)", () => {
    expect(isNonNarrowingWiden(base, { ...base })).toBe(true);
  });

  it("a larger radius is allowed; a smaller one narrows", () => {
    expect(isNonNarrowingWiden(base, { ...base, radiusM: 5000 })).toBe(true);
    expect(isNonNarrowingWiden(base, { ...base, radiusM: 2000 })).toBe(false);
  });

  it("adding a cuisine or clearing to 'any' is allowed; dropping narrows", () => {
    expect(
      isNonNarrowingWiden(base, { ...base, cuisines: ["italian", "thai"] }),
    ).toBe(true);
    expect(isNonNarrowingWiden(base, { ...base, cuisines: [] })).toBe(true);
    expect(isNonNarrowingWiden(base, { ...base, cuisines: ["thai"] })).toBe(
      false,
    );
  });

  it("adding a price level or clearing to 'any' is allowed; dropping narrows", () => {
    expect(
      isNonNarrowingWiden(base, { ...base, priceLevels: ["1", "2"] }),
    ).toBe(true);
    expect(isNonNarrowingWiden(base, { ...base, priceLevels: [] })).toBe(true);
    expect(isNonNarrowingWiden(base, { ...base, priceLevels: ["3"] })).toBe(
      false,
    );
  });

  it("locks open-now: changing it counts as narrowing", () => {
    expect(isNonNarrowingWiden(base, { ...base, openNow: false })).toBe(false);
    const offBase: WidenSnapshot = { ...base, openNow: false };
    expect(isNonNarrowingWiden(offBase, { ...offBase, openNow: true })).toBe(
      false,
    );
  });

  it("rejects when any single dimension narrows even if others broaden", () => {
    // Wider radius does not pay for a dropped cuisine (per-dimension rule).
    expect(
      isNonNarrowingWiden(base, {
        ...base,
        radiusM: 9000,
        cuisines: ["thai"],
      }),
    ).toBe(false);
  });

  it("an already-unrestricted session can only stay unrestricted", () => {
    const open: WidenSnapshot = {
      radiusM: 3000,
      openNow: false,
      cuisines: [],
      priceLevels: [],
    };
    expect(isNonNarrowingWiden(open, { ...open })).toBe(true);
    expect(isNonNarrowingWiden(open, { ...open, cuisines: ["italian"] })).toBe(
      false,
    );
    expect(isNonNarrowingWiden(open, { ...open, priceLevels: ["1"] })).toBe(
      false,
    );
  });
});
