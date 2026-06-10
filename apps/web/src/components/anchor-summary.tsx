import { MapPin } from "lucide-react";

/**
 * Read-only summary of the room's search anchor (static "Pinned location" + optional radius).
 * Shown in the lobby to every member: the anchor is host-controlled and set on Create Room via
 * the map (CLAUDE.md §2.2) — the lobby gets NO editable map, so this is informational only.
 * Non-hosts also see the radius here; the host edits the radius via the RadiusSlider, so
 * `radiusM` is omitted in that case to avoid double-showing it. Presentational only.
 *
 * The anchor is map-pick only (no free-text label, Phase 4.8 / docs/07 §6.8), so the location
 * always reads as a neutral "Pinned location".
 */
export function AnchorSummary({ radiusM }: { radiusM?: number }) {
  const label = "Pinned location";
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
