"use client";

import type { InputHTMLAttributes, ReactNode, Ref } from "react";

import { cx } from "./cx";

/**
 * Text input primitive (09-design-system.md §7 Field/Input): a filled, radius-md control
 * that grows a 2px amber border + soft amber outer glow on focus, with a faint
 * placeholder. Presentational only (CLAUDE.md §4) — it forwards all native input props
 * so callers keep their own value/handlers/validation. The 2px transparent resting
 * border reserves the space the focus border occupies, so focusing never shifts layout.
 * The web twin of the Phase B mobile Input (the amber glow is a brand-coloured ring).
 *
 * `leadingIcon` insets a glyph at the left of the control (the auth/join screens — person,
 * lock, mail). It sits over the input's left padding (so the focus border still wraps the
 * whole pill) and tints `text-faint`, shifting to `brand` while the field is focused.
 *
 * `ref` forwards to the underlying `<input>` (React 19 ref-as-prop) so callers can focus /
 * scroll the control — e.g. the Create Room form scrolling to the name field on an empty-name
 * submit.
 */
export function Input({
  className,
  leadingIcon,
  ref,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  leadingIcon?: ReactNode;
  ref?: Ref<HTMLInputElement>;
}) {
  const input = (
    <input
      ref={ref}
      {...props}
      className={cx(
        "min-h-11 w-full rounded-md border-2 border-transparent bg-surface-raised py-sm text-body-md text-text",
        "placeholder:text-text-faint",
        "focus:border-brand focus:outline-none focus-visible:ring-4 focus-visible:ring-brand/30",
        leadingIcon ? "pl-12 pr-gutter" : "px-gutter",
        className,
      )}
    />
  );
  if (!leadingIcon) return input;
  return (
    <div className="group relative">
      <span
        aria-hidden
        className="pointer-events-none absolute left-gutter top-1/2 -translate-y-1/2 text-text-faint group-focus-within:text-brand"
      >
        {leadingIcon}
      </span>
      {input}
    </div>
  );
}
