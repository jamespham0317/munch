/**
 * Shared map configuration for the Create Room anchor map (Phase 4.6,
 * docs/07-initial-roadmap.md §6.6). Defined ONCE here so both apps consume the
 * same OSM tile source, attribution, and fallback center — never re-defined per
 * app (CLAUDE.md §4).
 *
 * Pure data: no React Native / no DOM imports, like the rest of `@munch/core`.
 * The per-platform map components (`maplibre-gl` on web,
 * `@maplibre/maplibre-react-native` on mobile) consume {@link OSM_RASTER_STYLE}
 * and render {@link OSM_ATTRIBUTION}; each may cast the style to its own
 * `StyleSpecification` type at the boundary.
 *
 * The OSM tile endpoint is a SEPARATE, keyless source — it is NOT the restaurant
 * provider (CLAUDE.md §2.1). Fetching tiles is not a provider call, and OSM needs
 * no API key (so nothing here trips the secret-leak guard, scripts/check-secrets.sh).
 */

/** A geographic point. Shared by the map config and the Phase 4.6 geo math. */
export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Required OpenStreetMap attribution. Must render visibly on the map per the OSM
 * tile usage policy (docs/07 §6.6).
 */
export const OSM_ATTRIBUTION = "© OpenStreetMap contributors";

/** OSM raster tile endpoint (256px tiles, no key). */
export const OSM_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

/**
 * Neutral fallback center, used only when device geolocation is denied or
 * unavailable so the map still renders and the host can pan to set the anchor
 * (geolocation never blocks room creation, docs/07 §6.6). Defaults to downtown
 * San Francisco.
 */
export const DEFAULT_MAP_CENTER: LatLng = { lat: 37.7749, lng: -122.4194 };

/**
 * Minimal MapLibre raster style shape — just the fields this style uses. Both
 * platforms' style types are structurally compatible with this; a component may
 * cast it to the library's full `StyleSpecification` at the call site.
 */
export interface OsmRasterStyle {
  version: 8;
  sources: {
    osm: {
      type: "raster";
      tiles: string[];
      tileSize: number;
      attribution: string;
    };
  };
  layers: { id: string; type: "raster"; source: "osm" }[];
}

/**
 * MapLibre raster style backed by OSM tiles, shared by both map components. The
 * source carries the attribution so MapLibre's own attribution control can show
 * it; components should also keep {@link OSM_ATTRIBUTION} visible.
 */
export const OSM_RASTER_STYLE: OsmRasterStyle = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: [OSM_TILE_URL],
      tileSize: 256,
      attribution: OSM_ATTRIBUTION,
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};
