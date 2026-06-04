import type { ReactNode } from "react";

/**
 * Labeled field wrapper — an uppercase eyebrow label above its control
 * (09-design-system.md §5 label-md, §7). Presentational only (CLAUDE.md §4). Generic by
 * design: it labels text Inputs, chip rows, tiles, or the radius slider. `htmlFor`
 * ties the label to its control for the DOM (the web parity of the mobile Field).
 */
export function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
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
    </div>
  );
}
