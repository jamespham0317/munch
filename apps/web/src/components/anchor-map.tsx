"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import {
  circlePolygon,
  DEFAULT_MAP_CENTER,
  type LatLng,
  OSM_ATTRIBUTION,
  OSM_RASTER_STYLE,
  zoomForRadius,
} from "@munch/core";
import { MapPin } from "lucide-react";
import type { GeoJSONSource, Map as MaplibreMap } from "maplibre-gl";
import { useEffect, useRef } from "react";

/**
 * The Create Room anchor map (Phase 4.6, docs/07-initial-roadmap.md §6.6,
 * 09-design-system.md §7). A MapLibre GL map over keyless OpenStreetMap raster
 * tiles with a FIXED CENTER PIN: the host drags the map underneath the pin, so the
 * anchor is always the map's center — read on "moveend" and emitted via
 * onAnchorChange. A translucent amber radius ring (brand fill, heat stroke) tracks
 * `radiusM`, regenerated from the @munch/core circlePolygon helper, with the zoom
 * re-fit (zoomForRadius) so the ring stays visible as the slider moves.
 *
 * Presentational only — no data access, no domain logic, and NO provider call
 * (CLAUDE.md §4 / §2.1). OSM tiles are a separate, keyless source, not the
 * restaurant provider; the required "© OpenStreetMap contributors" attribution is
 * rendered via MapLibre's attribution control. Geolocation is opt-in and never
 * blocks: it is requested once on mount and only recenters the map when granted
 * (docs/07 §6.6). The amber colors come from the @munch/ui-seeded CSS tokens, never
 * hardcoded hex (CLAUDE.md §4). maplibre-gl is loaded lazily inside the effect so
 * its DOM-dependent code never runs during the server render.
 */

const CIRCLE_SOURCE_ID = "anchor-radius";
const CIRCLE_FILL_LAYER_ID = "anchor-radius-fill";
const CIRCLE_LINE_LAYER_ID = "anchor-radius-line";
const CIRCLE_FILL_OPACITY = 0.18;
const CIRCLE_STROKE_WIDTH = 2;

/** Square-fit pixel size used to pick a zoom that keeps the ring on screen. */
function viewportPx(container: HTMLElement): number {
  return (
    Math.min(container.clientWidth, container.clientHeight) ||
    container.clientWidth
  );
}

export function AnchorMap({
  radiusM,
  initialCenter,
  onAnchorChange,
}: {
  radiusM: number;
  initialCenter?: LatLng;
  onAnchorChange: (lat: number, lng: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  // Keep the latest callback / radius without re-running the mount effect.
  const onAnchorChangeRef = useRef(onAnchorChange);
  onAnchorChangeRef.current = onAnchorChange;
  const radiusRef = useRef(radiusM);
  radiusRef.current = radiusM;

  // Mount once: create the map, the radius ring, and the geolocation request.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let map: MaplibreMap | null = null;
    let cancelled = false;

    void (async () => {
      const maplibregl = (await import("maplibre-gl")).default;
      if (cancelled || !containerRef.current) return;

      const start = initialCenter ?? DEFAULT_MAP_CENTER;
      map = new maplibregl.Map({
        container,
        style: OSM_RASTER_STYLE,
        center: [start.lng, start.lat],
        zoom: zoomForRadius(radiusRef.current, viewportPx(container)),
        attributionControl: { customAttribution: OSM_ATTRIBUTION },
      });
      mapRef.current = map;

      // Resolve the amber tokens once (brand fill, heat stroke) — never hardcode hex.
      const tokens = getComputedStyle(document.documentElement);
      const fillColor = tokens.getPropertyValue("--color-brand").trim();
      const strokeColor = tokens.getPropertyValue("--color-heat").trim();

      map.on("load", () => {
        if (!map) return;
        map.addSource(CIRCLE_SOURCE_ID, {
          type: "geojson",
          data: circlePolygon(start, radiusRef.current),
        });
        map.addLayer({
          id: CIRCLE_FILL_LAYER_ID,
          type: "fill",
          source: CIRCLE_SOURCE_ID,
          paint: {
            "fill-color": fillColor,
            "fill-opacity": CIRCLE_FILL_OPACITY,
          },
        });
        map.addLayer({
          id: CIRCLE_LINE_LAYER_ID,
          type: "line",
          source: CIRCLE_SOURCE_ID,
          paint: {
            "line-color": strokeColor,
            "line-width": CIRCLE_STROKE_WIDTH,
          },
        });
      });

      // Anchor = map center: emit it and recenter the ring whenever the map settles.
      map.on("moveend", () => {
        if (!map) return;
        const center = map.getCenter();
        onAnchorChangeRef.current(center.lat, center.lng);
        const source = map.getSource<GeoJSONSource>(CIRCLE_SOURCE_ID);
        source?.setData(
          circlePolygon(
            { lat: center.lat, lng: center.lng },
            radiusRef.current,
          ),
        );
      });

      // Emit the starting center immediately so the form's anchor is never NaN.
      onAnchorChangeRef.current(start.lat, start.lng);

      // Opt-in geolocation: request once, recenter on grant, never block on denial.
      if (!initialCenter && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            if (cancelled || !map) return;
            // setCenter fires "moveend", which emits the anchor and moves the ring.
            map.setCenter([
              position.coords.longitude,
              position.coords.latitude,
            ]);
          },
          () => {
            // Denied/unavailable: stay on DEFAULT_MAP_CENTER and let the host pan.
          },
          { enableHighAccuracy: false, timeout: 10_000 },
        );
      }
    })();

    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
    };
  }, [initialCenter]);

  // Re-fit the ring + zoom when the radius slider changes (keep it visible).
  useEffect(() => {
    const map = mapRef.current;
    const container = containerRef.current;
    if (!map || !container) return;

    const apply = () => {
      const center = map.getCenter();
      const source = map.getSource<GeoJSONSource>(CIRCLE_SOURCE_ID);
      source?.setData(
        circlePolygon({ lat: center.lat, lng: center.lng }, radiusM),
      );
      map.easeTo({
        zoom: zoomForRadius(radiusM, viewportPx(container)),
        duration: 250,
      });
    };

    if (map.isStyleLoaded()) apply();
    else void map.once("load", apply);
  }, [radiusM]);

  return (
    <div className="relative h-80 w-full overflow-hidden rounded-xl border border-border">
      <div ref={containerRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <MapPin
          size={32}
          className="-translate-y-1/2 text-heat drop-shadow"
          aria-hidden
        />
      </div>
    </div>
  );
}
