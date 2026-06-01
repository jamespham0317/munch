import { describe, expect, it } from "vitest";

import { cuisineLabel, CUISINES } from "./constants";

describe("CUISINES taxonomy", () => {
  it("has unique ids", () => {
    const ids = CUISINES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("ids are non-empty lowercase-kebab (stable map keys)", () => {
    for (const { id } of CUISINES) {
      expect(id.length).toBeGreaterThan(0);
      expect(id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });

  it("every entry has a non-empty label", () => {
    for (const { label } of CUISINES) {
      expect(label.length).toBeGreaterThan(0);
    }
  });
});

describe("cuisineLabel", () => {
  it("returns the label for a known id", () => {
    expect(cuisineLabel("italian")).toBe("Italian");
  });

  it("falls back to the raw id for an unknown id", () => {
    expect(cuisineLabel("klingon")).toBe("klingon");
  });
});
