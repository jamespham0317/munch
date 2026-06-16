import { Feather } from "@expo/vector-icons";
import {
  Camera,
  type CameraRef,
  Map,
  type ViewStateChangeEvent,
} from "@maplibre/maplibre-react-native";
import {
  circleDiameterPx,
  DEFAULT_MAP_CENTER,
  type LatLng,
  OSM_ATTRIBUTION,
  OSM_RASTER_STYLE,
  zoomForRadius,
} from "@munch/core";
import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";
import {
  type LayoutChangeEvent,
  type NativeSyntheticEvent,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { colors, radii, spacing, typography } from "../theme";

/**
 * The Create Room anchor map (Phase 4.6, docs/07-initial-roadmap.md §6.6,
 * 09-design-system.md §7) — the RN twin of apps/web's AnchorMap. A MapLibre map over
 * keyless OpenStreetMap raster tiles with a FIXED CENTER PIN: the host drags the map
 * underneath the pin, so the anchor is always the map's center — read on
 * "regionDidChange" and emitted via onAnchorChange.
 *
 * The translucent amber radius ring (brand fill, heat stroke) is a FIXED-SIZE overlay
 * centered on the map — it never moves or resizes. `radiusM` drives the map ZOOM
 * instead (zoomForRadius, using the center latitude), so a ground circle of the
 * selected radius projects to exactly the fixed ring: dragging the slider zooms the
 * map in/out while the ring stays put and fully visible (docs/07 §6.6).
 *
 * The RadiusSlider is the ONLY zoom control: every user zoom gesture (pinch/scroll,
 * double-tap, double-tap-hold) is disabled, so the host can only PAN the map
 * (`dragPan` stays default-true). This keeps the fixed ring honest — it always
 * represents the selected radius, since nothing but the slider can change the zoom it
 * was fitted to. The Camera's programmatic zoom (the slider re-fit and the geolocation
 * recenter) is not gated by these gesture toggles, so it still works.
 *
 * Presentational only — no data access, no domain logic, and NO provider call
 * (CLAUDE.md §4 / §2.1). OSM tiles are a separate, keyless source, not the restaurant
 * provider; the required "© OpenStreetMap contributors" attribution is rendered as a
 * visible overlay. Geolocation is opt-in and never blocks: foreground permission is
 * requested once on mount via expo-location and only recenters the map when granted
 * (docs/07 §6.6). The amber colors come from the @munch/ui-backed theme, never
 * hardcoded hex (CLAUDE.md §4).
 */

const RING_FILL_OPACITY = 0.18; // brand fill, low-opacity (09-design-system §7).
const RING_STROKE_WIDTH = 2;
const MAP_HEIGHT = 320;
/** Fallback square-fit size until onLayout reports the real container width. */
const FALLBACK_VIEWPORT_PX = MAP_HEIGHT;

/** Brand hex (#rrggbb) + an alpha byte for the low-opacity ring fill — token-derived. */
const RING_FILL_COLOR = `${colors.brand}${Math.round(RING_FILL_OPACITY * 255)
  .toString(16)
  .padStart(2, "0")}`;

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
  const cameraRef = useRef<CameraRef>(null);
  // Keep the latest callback without re-running the mount effect.
  const onAnchorChangeRef = useRef(onAnchorChange);
  onAnchorChangeRef.current = onAnchorChange;

  const start = initialCenter ?? DEFAULT_MAP_CENTER;
  const [center, setCenter] = useState<LatLng>(start);
  const [viewportPx, setViewportPx] = useState(FALLBACK_VIEWPORT_PX);

  // Emit the starting center once so the form's anchor is never null/NaN, then
  // request geolocation: recenter on grant, stay on the fallback on denial (never block).
  // Read-only display does neither — it just shows the room's anchor (centered) + ring.
  useEffect(() => {
    if (readOnly) return;
    onAnchorChangeRef.current?.(start.lat, start.lng);
    if (initialCenter) return;

    let cancelled = false;
    void (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (cancelled || status !== Location.PermissionStatus.GRANTED) return;
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;
        const next = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        // Re-fit the zoom to the new latitude so the fixed ring still represents the
        // selected radius; easeTo settles into a regionDidChange, which emits the anchor.
        cameraRef.current?.easeTo({
          center: [next.lng, next.lat],
          zoom: zoomForRadius(radiusM, viewportPx, next.lat),
          duration: 250,
        });
      } catch {
        // Denied/unavailable: stay on DEFAULT_MAP_CENTER and let the host pan.
      }
    })();

    return () => {
      cancelled = true;
    };
    // Run once on mount; radiusM/viewportPx are read fresh inside the closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCenter, readOnly]);

  // Radius slider change → only the map zoom changes; the fixed ring stays put. Use
  // the live center latitude so the ring keeps representing the true ground radius.
  useEffect(() => {
    cameraRef.current?.zoomTo(zoomForRadius(radiusM, viewportPx, center.lat), {
      duration: 250,
    });
    // center.lat is read fresh inside the closure; we only re-fit on radius/size change,
    // not on every pan (latitude drift within a metro area is negligible).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radiusM, viewportPx]);

  function handleRegionDidChange(
    event: NativeSyntheticEvent<ViewStateChangeEvent>,
  ) {
    if (readOnly) return;
    const [lng, lat] = event.nativeEvent.center;
    setCenter({ lat, lng });
    onAnchorChangeRef.current?.(lat, lng);
  }

  function handleLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    setViewportPx(Math.min(width, height) || width);
  }

  const diameter = circleDiameterPx(viewportPx);

  return (
    <View style={styles.container} onLayout={handleLayout}>
      <Map
        style={StyleSheet.absoluteFill}
        mapStyle={OSM_RASTER_STYLE}
        onRegionDidChange={handleRegionDidChange}
        compass={false}
        logo={false}
        // Slider-only zoom: disable every user zoom gesture (and rotate/pitch); pan
        // stays via the default-true dragPan. Programmatic Camera zoom is unaffected.
        // readOnly also disables drag-pan — the static display can't move the anchor.
        touchZoom={false}
        doubleTapZoom={false}
        doubleTapHoldZoom={false}
        touchRotate={false}
        touchPitch={false}
        dragPan={!readOnly}
      >
        <Camera
          ref={cameraRef}
          initialViewState={{
            center: [start.lng, start.lat],
            zoom: zoomForRadius(radiusM, viewportPx, start.lat),
          }}
        />
      </Map>
      {/*
       * Fixed-size amber radius ring — never moves or resizes; the map zoom beneath it
       * represents the selected radius. brand low-opacity fill + heat stroke from the
       * @munch/ui-backed theme (09-design-system §7); circleDiameterPx keeps it inside
       * the map with margin (always fully visible).
       */}
      <View style={styles.ringWrap} pointerEvents="none">
        <View
          style={[
            styles.ring,
            { width: diameter, height: diameter, borderRadius: diameter / 2 },
          ]}
        />
      </View>
      <View style={styles.pin} pointerEvents="none">
        <Feather name="map-pin" size={32} color={colors.heat} />
      </View>
      <View style={styles.attribution} pointerEvents="none">
        <Text style={styles.attributionText}>{OSM_ATTRIBUTION}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: MAP_HEIGHT,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  ringWrap: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    borderWidth: RING_STROKE_WIDTH,
    borderColor: colors.heat,
    backgroundColor: RING_FILL_COLOR,
  },
  pin: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    // Lift the pin so its tip points at the map center, not its body.
    transform: [{ translateY: -16 }],
  },
  attribution: {
    position: "absolute",
    right: spacing.xs,
    bottom: spacing.xs,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceRaised,
  },
  attributionText: { ...typography.caption, color: colors.textMuted },
});
