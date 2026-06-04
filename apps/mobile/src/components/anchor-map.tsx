import { Feather } from "@expo/vector-icons";
import {
  Camera,
  type CameraRef,
  GeoJSONSource,
  Layer,
  Map,
  type ViewStateChangeEvent,
} from "@maplibre/maplibre-react-native";
import {
  circlePolygon,
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
 * "regionDidChange" and emitted via onAnchorChange. A translucent amber radius ring
 * (brand fill, heat stroke) tracks `radiusM`, regenerated from the @munch/core
 * circlePolygon helper, with the zoom re-fit (zoomForRadius) so the ring stays visible
 * as the slider moves.
 *
 * Presentational only — no data access, no domain logic, and NO provider call
 * (CLAUDE.md §4 / §2.1). OSM tiles are a separate, keyless source, not the restaurant
 * provider; the required "© OpenStreetMap contributors" attribution is rendered as a
 * visible overlay. Geolocation is opt-in and never blocks: foreground permission is
 * requested once on mount via expo-location and only recenters the map when granted
 * (docs/07 §6.6). The amber colors come from the @munch/ui-backed theme, never
 * hardcoded hex (CLAUDE.md §4).
 */

const CIRCLE_SOURCE_ID = "anchor-radius";
const CIRCLE_FILL_LAYER_ID = "anchor-radius-fill";
const CIRCLE_LINE_LAYER_ID = "anchor-radius-line";
const CIRCLE_FILL_OPACITY = 0.18;
const CIRCLE_STROKE_WIDTH = 2;
const MAP_HEIGHT = 320;
/** Fallback square-fit size until onLayout reports the real container width. */
const FALLBACK_VIEWPORT_PX = MAP_HEIGHT;

export function AnchorMap({
  radiusM,
  initialCenter,
  onAnchorChange,
}: {
  radiusM: number;
  initialCenter?: LatLng;
  onAnchorChange: (lat: number, lng: number) => void;
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
  useEffect(() => {
    onAnchorChangeRef.current(start.lat, start.lng);
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
        // easeTo settles into a regionDidChange, which emits the anchor + moves the ring.
        cameraRef.current?.easeTo({
          center: [next.lng, next.lat],
          zoom: zoomForRadius(radiusM, viewportPx),
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
  }, [initialCenter]);

  // Re-fit the zoom when the radius slider changes (keep the ring visible). The ring
  // itself re-renders from `center` + `radiusM` below.
  useEffect(() => {
    cameraRef.current?.zoomTo(zoomForRadius(radiusM, viewportPx), {
      duration: 250,
    });
  }, [radiusM, viewportPx]);

  function handleRegionDidChange(
    event: NativeSyntheticEvent<ViewStateChangeEvent>,
  ) {
    const [lng, lat] = event.nativeEvent.center;
    setCenter({ lat, lng });
    onAnchorChangeRef.current(lat, lng);
  }

  function handleLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    setViewportPx(Math.min(width, height) || width);
  }

  return (
    <View style={styles.container} onLayout={handleLayout}>
      <Map
        style={StyleSheet.absoluteFill}
        mapStyle={OSM_RASTER_STYLE}
        onRegionDidChange={handleRegionDidChange}
        compass={false}
        logo={false}
      >
        <Camera
          ref={cameraRef}
          initialViewState={{
            center: [start.lng, start.lat],
            zoom: zoomForRadius(radiusM, viewportPx),
          }}
        />
        <GeoJSONSource
          id={CIRCLE_SOURCE_ID}
          data={circlePolygon(center, radiusM)}
        >
          <Layer
            id={CIRCLE_FILL_LAYER_ID}
            type="fill"
            style={{
              fillColor: colors.brand,
              fillOpacity: CIRCLE_FILL_OPACITY,
            }}
          />
          <Layer
            id={CIRCLE_LINE_LAYER_ID}
            type="line"
            style={{
              lineColor: colors.heat,
              lineWidth: CIRCLE_STROKE_WIDTH,
            }}
          />
        </GeoJSONSource>
      </Map>
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
