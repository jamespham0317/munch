import { RADIUS_MIN_M } from "@munch/core";

/**
 * Local-only radius slider, restyled to design-system.md §7 (amber thumb + amber value
 * pill, "Distance" label). Bound to UI state and the deck's local distance filter —
 * adjusting it NEVER refetches the provider (CLAUDE.md §2.1; widen is a separate flow).
 * The upper bound is the session's snapshotted radius (the radius the deck was fetched
 * at); the lower bound is the shared RADIUS_MIN_M constant. Presentational only.
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
    <div className="flex flex-col gap-xs">
      <div className="flex items-center justify-between">
        <span className="text-body-md text-text-muted">Distance</span>
        <span className="rounded-full bg-brand px-sm py-xs text-caption text-on-brand">
          {formatKm(valueM)}
        </span>
      </div>
      <input
        type="range"
        min={RADIUS_MIN_M}
        max={maxM}
        step={100}
        value={valueM}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label="Search radius"
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-border accent-brand [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-brand [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand"
      />
    </div>
  );
}

function formatKm(metres: number): string {
  return `${(metres / 1000).toFixed(1)} km`;
}
