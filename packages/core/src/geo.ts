/**
 * Pure geo math for the Create Room anchor map (Phase 4.6,
 * docs/07-initial-roadmap.md §6.6). Both map components — `maplibre-gl` on web,
 * `@maplibre/maplibre-react-native` on mobile — render the amber radius ring from
 * {@link circlePolygon} and pick an initial / re-fit zoom from {@link zoomForRadius}.
 *
 * Pure functions only: no React / RN / DOM imports, like the rest of `@munch/core`
 * (CLAUDE.md §4). The radius bounds come from {@link RADIUS_MIN_M}/{@link RADIUS_MAX_M}
 * so client and server agree on the same limits (docs/08-tech-stack.md §"Maps/geo").
 */
import { RADIUS_MAX_M, RADIUS_MIN_M } from "./constants";
import type { LatLng } from "./maps";

/** Mean Earth radius in metres, used for the metres↔degrees conversion. */
const EARTH_RADIUS_M = 6_371_000;
const DEG_PER_RAD = 180 / Math.PI;
const RAD_PER_DEG = Math.PI / 180;

/**
 * Web-Mercator ground resolution at zoom 0 and the equator, in metres per pixel
 * (for 256px tiles). Resolution halves with each zoom level: `value / 2 ** zoom`.
 */
const EQUATOR_M_PER_PX_Z0 = 156_543.03392;
/** Fraction of the viewport the circle's diameter should span (leaves margin). */
const FIT_FRACTION = 0.8;
/** Sane zoom clamp so {@link zoomForRadius} never returns a degenerate level. */
const MIN_ZOOM = 1;
const MAX_ZOOM = 20;

/** Clamp a radius to the shared [{@link RADIUS_MIN_M}, {@link RADIUS_MAX_M}] bounds. */
function clampRadius(radiusM: number): number {
  return Math.min(RADIUS_MAX_M, Math.max(RADIUS_MIN_M, radiusM));
}

/**
 * Build a closed GeoJSON polygon approximating a circle of `radiusM` around
 * `center`, used as the MapLibre `fill` source for the amber radius ring on both
 * platforms. `radiusM` is clamped to the shared radius bounds.
 *
 * The longitude offset is divided by `cos(lat)` so the ring stays circular on the
 * ground as latitude increases (equirectangular approximation — accurate well
 * within a metre at the ≤20 km radii this app uses). Returns `steps + 1`
 * coordinates: the last vertex is the same computed point as the first, so the
 * ring is exactly closed as GeoJSON requires.
 */
export function circlePolygon(
  center: LatLng,
  radiusM: number,
  steps = 64,
): GeoJSON.Feature<GeoJSON.Polygon> {
  const r = clampRadius(radiusM);
  const cosLat = Math.cos(center.lat * RAD_PER_DEG);

  const vertex = (i: number): GeoJSON.Position => {
    const angle = (2 * Math.PI * i) / steps;
    const dLat = ((r * Math.cos(angle)) / EARTH_RADIUS_M) * DEG_PER_RAD;
    const dLng =
      ((r * Math.sin(angle)) / (EARTH_RADIUS_M * cosLat)) * DEG_PER_RAD;
    return [center.lng + dLng, center.lat + dLat];
  };

  const ring: GeoJSON.Position[] = [];
  for (let i = 0; i < steps; i++) ring.push(vertex(i));
  ring.push(vertex(0)); // close the ring with the same point as the first vertex

  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [ring] },
  };
}

/**
 * Web-Mercator zoom at which a circle of `radiusM` comfortably fits a square
 * viewport of `viewportPx` pixels — used for the map's initial zoom and to re-fit
 * when the radius changes so the ring stays visible. `radiusM` is clamped to the
 * shared bounds, and the result is clamped to [{@link MIN_ZOOM}, {@link MAX_ZOOM}].
 * Monotonic: a larger radius yields a lower (more zoomed-out) zoom.
 */
export function zoomForRadius(radiusM: number, viewportPx: number): number {
  const diameterM = 2 * clampRadius(radiusM);
  const targetMPerPx = diameterM / (FIT_FRACTION * viewportPx);
  const zoom = Math.log2(EQUATOR_M_PER_PX_Z0 / targetMPerPx);
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}
