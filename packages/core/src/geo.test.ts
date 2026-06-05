import { describe, expect, it } from "vitest";

import { RADIUS_MAX_M, RADIUS_MIN_M } from "./constants";
import {
  CIRCLE_VIEWPORT_FRACTION,
  circleDiameterPx,
  zoomForRadius,
} from "./geo";

/** Mirror of the projection geo.ts inverts, used to verify the chosen zoom. */
const EQUATOR_M_PER_PX_Z0 = 156_543.03392;
function metresPerPx(zoom: number, lat: number): number {
  return (EQUATOR_M_PER_PX_Z0 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
}

describe("circleDiameterPx", () => {
  it("is the configured fraction of the viewport", () => {
    expect(circleDiameterPx(360)).toBe(CIRCLE_VIEWPORT_FRACTION * 360);
  });
});

describe("zoomForRadius", () => {
  const viewportPx = 360;
  const lat = 37.7749; // San Francisco

  it("projects the ground circle onto the fixed ring at the chosen zoom", () => {
    // For an unclamped radius, the ground diameter at the chosen zoom should fill
    // exactly the fixed pixel diameter — that is the whole point of the helper.
    for (const radiusM of [800, 3_000, 9_000]) {
      const zoom = zoomForRadius(radiusM, viewportPx, lat);
      const groundDiameterPx = (2 * radiusM) / metresPerPx(zoom, lat);
      expect(groundDiameterPx).toBeCloseTo(circleDiameterPx(viewportPx), 3);
    }
  });

  it("is monotonic: a larger radius yields a lower zoom", () => {
    const radii = [500, 1_000, 3_000, 8_000, 15_000, 20_000];
    const zooms = radii.map((r) => zoomForRadius(r, viewportPx, lat));
    for (let i = 1; i < zooms.length; i++) {
      expect(zooms[i]).toBeLessThan(zooms[i - 1] as number);
    }
  });

  it("is monotonic in latitude: a higher |lat| yields a lower zoom", () => {
    const lats = [0, 20, 40, 60, 75];
    const zooms = lats.map((l) => zoomForRadius(3_000, viewportPx, l));
    for (let i = 1; i < zooms.length; i++) {
      expect(zooms[i]).toBeLessThan(zooms[i - 1] as number);
    }
  });

  it("stays within the [1, 20] bounds", () => {
    for (const r of [RADIUS_MIN_M, 3_000, RADIUS_MAX_M]) {
      const z = zoomForRadius(r, viewportPx, lat);
      expect(z).toBeGreaterThanOrEqual(1);
      expect(z).toBeLessThanOrEqual(20);
    }
  });

  it("clamps to the lower bound for an extreme zoom-out", () => {
    expect(zoomForRadius(RADIUS_MAX_M, 0.1, lat)).toBe(1);
  });

  it("clamps to the upper bound for an extreme zoom-in", () => {
    expect(zoomForRadius(RADIUS_MIN_M, 1_000_000, lat)).toBe(20);
  });

  it("clamps the radius below/above the bounds", () => {
    expect(zoomForRadius(100, viewportPx, lat)).toBe(
      zoomForRadius(RADIUS_MIN_M, viewportPx, lat),
    );
    expect(zoomForRadius(999_999, viewportPx, lat)).toBe(
      zoomForRadius(RADIUS_MAX_M, viewportPx, lat),
    );
  });
});
