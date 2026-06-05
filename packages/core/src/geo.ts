/**
 * Pure geo math for the Create Room anchor map (Phase 4.6,
 * docs/07-initial-roadmap.md §6.6). Both map components — `maplibre-gl` on web,
 * `@maplibre/maplibre-react-native` on mobile — draw the amber radius ring as a
 * FIXED-SIZE overlay centered on the map (it never moves or resizes) and pick the
 * map zoom from {@link zoomForRadius} so that a circle of `radiusM` on the ground
 * projects to exactly that fixed pixel size at the map center. Changing the radius
 * slider therefore only changes the zoom — the ring stays put and fully visible.
 * {@link circleDiameterPx} is the single source for the ring's on-screen diameter,
 * shared by the zoom math here and the overlay rendered by each component.
 *
 * Pure functions only: no React / RN / DOM imports, like the rest of `@munch/core`
 * (CLAUDE.md §4). The radius bounds come from {@link RADIUS_MIN_M}/{@link RADIUS_MAX_M}
 * so client and server agree on the same limits (docs/08-tech-stack.md §"Maps/geo").
 */
import { RADIUS_MAX_M, RADIUS_MIN_M } from "./constants";

const RAD_PER_DEG = Math.PI / 180;

/**
 * Web-Mercator ground resolution at zoom 0 and the equator, in metres per pixel
 * (for 256px tiles). Resolution at a given zoom and latitude is
 * `value * cos(lat) / 2 ** zoom` — the `cos(lat)` factor is why the zoom depends
 * on the map's latitude, not just the radius.
 */
const EQUATOR_M_PER_PX_Z0 = 156_543.03392;
/**
 * The ring's diameter as a fraction of the smaller viewport side. < 1 so the ring
 * always sits inside the map with margin to spare (i.e. is always fully visible).
 */
export const CIRCLE_VIEWPORT_FRACTION = 0.8;
/** Sane zoom clamp so {@link zoomForRadius} never returns a degenerate level. */
const MIN_ZOOM = 1;
const MAX_ZOOM = 20;

/** Clamp a radius to the shared [{@link RADIUS_MIN_M}, {@link RADIUS_MAX_M}] bounds. */
function clampRadius(radiusM: number): number {
  return Math.min(RADIUS_MAX_M, Math.max(RADIUS_MIN_M, radiusM));
}

/**
 * On-screen diameter of the fixed radius ring, in pixels, for a square-fit viewport
 * of `viewportPx` (the smaller of the map container's width/height). The ring is a
 * constant size regardless of the selected radius — the map zoom does the work.
 */
export function circleDiameterPx(viewportPx: number): number {
  return CIRCLE_VIEWPORT_FRACTION * viewportPx;
}

/**
 * Web-Mercator zoom at which a circle of `radiusM` on the ground projects to the
 * fixed {@link circleDiameterPx} ring on a square viewport of `viewportPx` pixels at
 * latitude `lat`. Used for the map's initial zoom and to re-fit when the radius
 * slider changes so the fixed ring keeps representing the selected radius.
 *
 * `radiusM` is clamped to the shared bounds and the result to
 * [{@link MIN_ZOOM}, {@link MAX_ZOOM}]. Monotonic in radius (a larger radius yields a
 * lower, more zoomed-out level) and in latitude (a higher |latitude| yields a lower
 * level, since each pixel covers fewer ground metres away from the equator).
 */
export function zoomForRadius(
  radiusM: number,
  viewportPx: number,
  lat: number,
): number {
  const groundDiameterM = 2 * clampRadius(radiusM);
  // Metres-per-pixel the projection must have for the ground circle to fill the
  // fixed ring, then solve EQUATOR_M_PER_PX_Z0 * cos(lat) / 2**zoom = targetMPerPx.
  const targetMPerPx = groundDiameterM / circleDiameterPx(viewportPx);
  const cosLat = Math.cos(lat * RAD_PER_DEG);
  const zoom = Math.log2((EQUATOR_M_PER_PX_Z0 * cosLat) / targetMPerPx);
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}
