"use client";

import type { ReactNode } from "react";

import { cx } from "./cx";

/**
 * Pill button primitive (09-design-system.md §7). Presentational only — no data, no hooks
 * (CLAUDE.md §4). The web twin of the Phase B mobile Button: same variant set and look,
 * implemented as a real <button> (so the handler is the DOM-native `onClick`). Variants
 * map to the semantic roles: `primary` (amber fill, charcoal text), `secondary`
 * (burnt-orange fill, white text), `ghost` (2px outline, transparent), `social` (white
 * with a leading provider-logo slot), `text` (borderless amber label, transparent fill
 * with a faint amber hover wash — the low-emphasis secondary action, e.g. Cancel),
 * `neutral` (filled grey surface with muted text — the modal "Stay"/"Cancel" dismiss
 * action). Pressed applies the 2px press translate; the primary fill darkens to
 * brand-pressed on hover. focus-visible ring; min 44px target.
 */
type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "social"
  | "text"
  | "neutral";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-brand text-on-brand hover:bg-brand-pressed",
  secondary: "bg-heat text-on-heat",
  ghost: "border-2 border-border bg-transparent text-text",
  social: "bg-surface text-text shadow-low",
  text: "bg-transparent text-brand hover:bg-brand/5",
  neutral: "bg-surface-highest text-text-muted hover:bg-surface-sunken",
};

export function Button({
  label,
  onClick,
  variant = "primary",
  type = "button",
  disabled = false,
  loading = false,
  leadingIcon,
  "aria-label": ariaLabel,
}: {
  label: string;
  onClick?: () => void;
  variant?: ButtonVariant;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  loading?: boolean;
  /** Optional leading glyph — the `social` variant's provider-logo slot. */
  leadingIcon?: ReactNode;
  "aria-label"?: string;
}) {
  const isDisabled = disabled || loading;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      aria-busy={loading}
      aria-label={ariaLabel ?? label}
      className={cx(
        "inline-flex min-h-11 items-center justify-center gap-sm rounded-full px-md py-sm text-title-lg",
        "transition-transform active:translate-y-[var(--munch-press-translate-y)] motion-reduce:transition-none",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/40",
        "disabled:opacity-50 disabled:active:translate-y-0",
        VARIANT_CLASSES[variant],
      )}
    >
      {loading ? (
        <span
          aria-hidden
          className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none"
        />
      ) : (
        <>
          {leadingIcon}
          <span>{label}</span>
        </>
      )}
    </button>
  );
}
