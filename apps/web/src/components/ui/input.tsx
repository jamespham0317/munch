"use client";

import type { InputHTMLAttributes } from "react";

import { cx } from "./cx";

/**
 * Text input primitive (design-system.md §7 Field/Input): a filled, radius-md control
 * that grows a 2px amber border + soft amber outer glow on focus, with a faint
 * placeholder. Presentational only (CLAUDE.md §4) — it forwards all native input props
 * so callers keep their own value/handlers/validation. The 2px transparent resting
 * border reserves the space the focus border occupies, so focusing never shifts layout.
 * The web twin of the Phase B mobile Input (the amber glow is a brand-coloured ring).
 */
export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cx(
        "min-h-11 w-full rounded-md border-2 border-transparent bg-surface-raised px-gutter py-sm text-body-md text-text",
        "placeholder:text-text-faint",
        "focus:border-brand focus:outline-none focus-visible:ring-4 focus-visible:ring-brand/30",
        className,
      )}
    />
  );
}
