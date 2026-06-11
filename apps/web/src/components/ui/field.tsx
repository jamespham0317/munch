import type { ReactNode } from "react";

/**
 * Labeled field wrapper — an uppercase eyebrow label above its control
 * (09-design-system.md §5 label-md, §7). Presentational only (CLAUDE.md §4). Generic by
 * design: it labels text Inputs, chip rows, tiles, or the radius slider. `htmlFor`
 * ties the label to its control for the DOM (the web parity of the mobile Field).
 * `error`, when set, renders a field-level error message below the control; Field does
 * no validation itself — the form decides when to show it.
 */
export function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-base">
      <label
        htmlFor={htmlFor}
        className="text-label-md uppercase text-text-muted"
      >
        {label}
      </label>
      {children}
      {error ? (
        <p
          id={htmlFor ? `${htmlFor}-error` : undefined}
          role="alert"
          className="text-body-md text-error"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
