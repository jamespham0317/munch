"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import {
  circleDiameterPx,
  DEFAULT_MAP_CENTER,
  type LatLng,
  OSM_ATTRIBUTION,
  OSM_RASTER_STYLE,
  zoomForRadius,
} from "@munch/core";
import { MapPin } from "lucide-react";
import type { Map as MaplibreMap } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";

/**
 * The Create Room anchor map (Phase 4.6, docs/07-initial-roadmap.md §6.6,
 * 09-design-system.md §7). A MapLibre GL map over keyless OpenStreetMap raster
 * tiles with a FIXED CENTER PIN: the host drags the map underneath the pin, so the
 * anchor is always the map's center — read on "moveend" and emitted via
 * onAnchorChange.
 *
 * The translucent amber radius ring (brand fill, heat stroke) is a FIXED-SIZE
 * overlay centered on the map — it never moves or resizes. `radiusM` drives the map
 * ZOOM instead (zoomForRadius, using the center latitude), so a ground circle of the
 * selected radius projects to exactly the fixed ring: dragging the slider zooms the
 * map in/out while the ring stays put and fully visible (docs/07 §6.6).
 *
 * The RadiusSlider is the ONLY zoom control: every user zoom gesture (scroll, pinch,
 * double-tap, box-zoom, and keyboard +/-) is disabled at construction, so the host can
 * only PAN the map. This keeps the fixed ring honest — it always represents the
 * selected radius, since nothing but the slider can change the zoom it was fitted to.
 * Programmatic camera moves (the slider re-fit and the geolocation recenter below) are
 * not gated by these handlers, so they still work.
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

const MAP_HEIGHT_PX = 320; // matches the h-80 container; the square-fit fallback.
const RING_FILL_OPACITY_PCT = 18; // brand fill, low-opacity (09-design-system §7).

/** Square-fit pixel size (smaller side) used to size the ring and pick the zoom. */
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
  readOnly = false,
}: {
  radiusM: number;
  initialCenter?: LatLng;
  onAnchorChange?: (lat: number, lng: number) => void;
  /**
   * Read-only display (the lobby's non-host view, docs/10 §3.5): the map is centered on
   * `initialCenter` (the room anchor) with the radius ring, but ALL interaction is disabled
   * (drag-pan too, on top of the always-off zoom gestures) and no anchor is emitted. The
   * editable Create Room / host-lobby-sheet usage leaves this false. Default false.
   */
  readOnly?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  // Keep the latest callback / radius without re-running the mount effect.
  const onAnchorChangeRef = useRef(onAnchorChange);
  onAnchorChangeRef.current = onAnchorChange;
  const radiusRef = useRef(radiusM);
  radiusRef.current = radiusM;
  // Tracked container size drives both the fixed ring's diameter and the zoom math.
  const [vpx, setVpx] = useState(MAP_HEIGHT_PX);

  // Mount once: create the map and the opt-in geolocation request.
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
        zoom: zoomForRadius(
          radiusRef.current,
          viewportPx(container),
          start.lat,
        ),
        attributionControl: { customAttribution: OSM_ATTRIBUTION },
        // Slider-only zoom: disable every user zoom gesture; keep drag-pan (default).
        // `keyboard` binds both arrow-pan and +/- zoom and can't be split, so it goes
        // too (drag-pan remains the way to move the map). In readOnly the map is a static
        // display, so drag-pan is disabled too — the anchor can't move.
        scrollZoom: false,
        boxZoom: false,
        doubleClickZoom: false,
        touchZoomRotate: false,
        dragRotate: false,
        keyboard: false,
        dragPan: !readOnly,
      });
      mapRef.current = map;

      // Read-only display: no anchor emission, no geolocation — the map just shows the
      // room's current anchor (centered) with the radius ring.
      if (!readOnly) {
        // Anchor = map center: emit it whenever the map settles. The ring is a fixed
        // overlay centered on the map, so there is nothing to reposition here.
        map.on("moveend", () => {
          if (!map) return;
          const center = map.getCenter();
          onAnchorChangeRef.current?.(center.lat, center.lng);
        });

        // Emit the starting center immediately so the form's anchor is never NaN.
        onAnchorChangeRef.current?.(start.lat, start.lng);
      }

      // Opt-in geolocation: request once, recenter on grant, never block on denial.
      if (!readOnly && !initialCenter && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            if (cancelled || !map) return;
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            // Re-fit the zoom to the new latitude so the fixed ring still represents
            // the selected radius; "moveend" then emits the anchor.
            map.easeTo({
              center: [lng, lat],
              zoom: zoomForRadius(
                radiusRef.current,
                viewportPx(map.getContainer()),
                lat,
              ),
              duration: 250,
            });
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
  }, [initialCenter, readOnly]);

  // Track the container size so the fixed ring and the zoom math stay in sync with
  // responsive width changes.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const update = () => setVpx(viewportPx(container));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Radius slider change → only the map zoom changes; the fixed ring stays put. Use
  // the live center latitude so the ring keeps representing the true ground radius.
  useEffect(() => {
    const map = mapRef.current;
    const container = containerRef.current;
    if (!map || !container) return;

    const apply = () => {
      map.easeTo({
        zoom: zoomForRadius(
          radiusM,
          viewportPx(container),
          map.getCenter().lat,
        ),
        duration: 250,
      });
    };

    if (map.isStyleLoaded()) apply();
    else void map.once("load", apply);
  }, [radiusM]);

  const diameter = circleDiameterPx(vpx);

  return (
    <div className="relative h-80 w-full">
      {/*
       * MapLibre attaches to a NORMALLY-POSITIONED, directly-sized container
       * (`h-full w-full`), never an `absolute` one: a WebGL canvas inside an
       * absolutely-positioned container fails to composite (renders to its buffer
       * but never displays) on some GPU/ANGLE configs inside the full app page.
       * The fixed ring + center pin stay absolute siblings overlaid on top.
       */}
      <div
        ref={containerRef}
        className="h-full w-full overflow-hidden rounded-xl border border-border"
      />
      {/*
       * Fixed-size amber radius ring — never moves or resizes; the map zoom beneath
       * it represents the selected radius. brand low-opacity fill + heat stroke,
       * from the seeded CSS tokens (09-design-system §7); CIRCLE_VIEWPORT_FRACTION
       * keeps it inside the map with margin (always fully visible). The diameter is a
       * prop-computed dynamic size — the one inline-style exception (docs/11 §4).
       */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div
          aria-hidden
          className="rounded-full border-2 border-heat"
          style={{
            width: diameter,
            height: diameter,
            backgroundColor: `color-mix(in srgb, var(--color-brand) ${RING_FILL_OPACITY_PCT}%, transparent)`,
          }}
        />
      </div>
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
