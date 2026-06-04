"use client";

import { cx } from "./cx";

/**
 * Selection toggle with the playful "bite-out-of-a-circle" mark (09-design-system.md §7,
 * §2). Presentational only (CLAUDE.md §4): value is controlled by the caller. When on,
 * a brand-filled circle has a surface-coloured "bite" notched out of its top-right
 * corner. The web twin of the Phase B mobile Toggle.
 */
export function Toggle({
  value,
  onValueChange,
  label,
  disabled = false,
}: {
  value: boolean;
  onValueChange: (value: boolean) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={value}
      aria-label={label}
      disabled={disabled}
      onClick={() => onValueChange(!value)}
      className={cx(
        "inline-flex items-center gap-base rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/40",
        disabled && "opacity-50",
      )}
    >
      <span
        className={cx(
          "relative h-6 w-6 overflow-hidden rounded-full",
          value ? "bg-brand" : "border-2 border-border",
        )}
      >
        {value ? (
          <span className="absolute -right-[30%] -top-[30%] h-[70%] w-[70%] rounded-full bg-surface" />
        ) : null}
      </span>
      {label ? <span className="text-body-md text-text">{label}</span> : null}
    </button>
  );
}
