import { MapPin } from "lucide-react";

/**
 * Read-only summary of the room's search anchor (location label + optional radius). Shown in
 * the lobby to every member: the anchor is host-controlled and set on Create Room via the map
 * (CLAUDE.md §2.2) — the lobby gets NO editable map, so this is informational only. Non-hosts
 * also see the radius here; the host edits the radius via the RadiusSlider, so `radiusM` is
 * omitted in that case to avoid double-showing it. Presentational only.
 *
 * There is no reverse-geocoding (map-pick only), so `anchorLabel` is often blank — a neutral
 * "Pinned location" fallback is shown then.
 */
export function AnchorSummary({
  anchorLabel,
  radiusM,
}: {
  anchorLabel: string | null;
  radiusM?: number;
}) {
  const label = anchorLabel?.trim() ? anchorLabel.trim() : "Pinned location";
  const parts = radiusM === undefined ? [label] : [label, formatKm(radiusM)];

  return (
    <p className="flex items-center gap-xs text-body-md text-text-muted">
      <MapPin size={14} className="text-heat" aria-hidden />
      {parts.join(" · ")}
    </p>
  );
}

function formatKm(metres: number): string {
  return `${(metres / 1000).toFixed(1)} km`;
}
