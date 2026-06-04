import { describe, expect, it } from "vitest";

import { RADIUS_MAX_M, RADIUS_MIN_M } from "./constants";
import { circlePolygon, zoomForRadius } from "./geo";
import type { LatLng } from "./maps";

/**
 * Independent great-circle distance (haversine) used to verify the polygon's
 * vertices, so the test isn't just re-deriving the implementation's own formula.
 */
function haversineM(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const ring = (f: GeoJSON.Feature<GeoJSON.Polygon>): GeoJSON.Position[] => {
  const coords = f.geometry.coordinates[0];
  if (!coords) throw new Error("expected a polygon ring");
  return coords;
};

const toLatLng = (p: GeoJSON.Position): LatLng => ({
  lng: p[0] ?? 0,
  lat: p[1] ?? 0,
});

describe("circlePolygon", () => {
  const center: LatLng = { lat: 37.7749, lng: -122.4194 };

  it("returns a closed Feature<Polygon>", () => {
    const f = circlePolygon(center, 3_000);
    expect(f.type).toBe("Feature");
    expect(f.geometry.type).toBe("Polygon");
    const r = ring(f);
    expect(r[0]).toEqual(r[r.length - 1]); // first === last (closed)
  });

  it("has steps + 1 coordinates (default and custom steps)", () => {
    expect(ring(circlePolygon(center, 3_000)).length).toBe(65);
    expect(ring(circlePolygon(center, 3_000, 8)).length).toBe(9);
  });

  it.each([
    ["low latitude", 1],
    ["high latitude", 60],
  ])("places every vertex ~radiusM from center at %s", (_label, lat) => {
    const c: LatLng = { lat, lng: 10 };
    const radiusM = 5_000;
    for (const p of ring(circlePolygon(c, radiusM))) {
      // within 1% — equirectangular vs. haversine differ by < a metre at this scale
      expect(haversineM(c, toLatLng(p))).toBeGreaterThan(radiusM * 0.99);
      expect(haversineM(c, toLatLng(p))).toBeLessThan(radiusM * 1.01);
    }
  });

  it("is accurate at the radius bounds", () => {
    for (const radiusM of [RADIUS_MIN_M, RADIUS_MAX_M]) {
      for (const p of ring(circlePolygon(center, radiusM))) {
        expect(haversineM(center, toLatLng(p))).toBeGreaterThan(radiusM * 0.99);
        expect(haversineM(center, toLatLng(p))).toBeLessThan(radiusM * 1.01);
      }
    }
  });

  it("clamps a radius below/above the bounds", () => {
    expect(circlePolygon(center, 100)).toEqual(
      circlePolygon(center, RADIUS_MIN_M),
    );
    expect(circlePolygon(center, 999_999)).toEqual(
      circlePolygon(center, RADIUS_MAX_M),
    );
  });
});

describe("zoomForRadius", () => {
  const viewportPx = 360;

  it("is monotonic: a larger radius yields a lower zoom", () => {
    const radii = [500, 1_000, 3_000, 8_000, 15_000, 20_000];
    const zooms = radii.map((r) => zoomForRadius(r, viewportPx));
    for (let i = 1; i < zooms.length; i++) {
      expect(zooms[i]).toBeLessThan(zooms[i - 1] as number);
    }
  });

  it("stays within the [1, 20] bounds", () => {
    for (const r of [RADIUS_MIN_M, 3_000, RADIUS_MAX_M]) {
      const z = zoomForRadius(r, viewportPx);
      expect(z).toBeGreaterThanOrEqual(1);
      expect(z).toBeLessThanOrEqual(20);
    }
  });

  it("clamps to the lower bound for an extreme zoom-out", () => {
    expect(zoomForRadius(RADIUS_MAX_M, 0.1)).toBe(1);
  });

  it("clamps to the upper bound for an extreme zoom-in", () => {
    expect(zoomForRadius(RADIUS_MIN_M, 1_000_000)).toBe(20);
  });

  it("clamps the radius below/above the bounds", () => {
    expect(zoomForRadius(100, viewportPx)).toBe(
      zoomForRadius(RADIUS_MIN_M, viewportPx),
    );
    expect(zoomForRadius(999_999, viewportPx)).toBe(
      zoomForRadius(RADIUS_MAX_M, viewportPx),
    );
  });
});
