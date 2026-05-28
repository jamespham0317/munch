import { RADIUS_MIN_M } from "@munch/core";

/**
 * Local-only radius slider. Bound to UI state and the deck's local distance filter —
 * adjusting it NEVER refetches the provider (CLAUDE.md §2.1; widen is Phase 3). The
 * upper bound is the session's snapshotted radius (the radius the deck was fetched at);
 * the lower bound is the shared RADIUS_MIN_M constant.
 */
export function RadiusSlider({
  valueM,
  maxM,
  onChange,
}: {
  valueM: number;
  maxM: number;
  onChange: (value: number) => void;
}) {
  return (
    <label>
      Show within {formatKm(valueM)}
      <input
        type="range"
        min={RADIUS_MIN_M}
        max={maxM}
        step={100}
        value={valueM}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function formatKm(metres: number): string {
  return `${(metres / 1000).toFixed(1)} km`;
}
