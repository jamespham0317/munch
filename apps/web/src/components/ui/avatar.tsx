/**
 * Circular avatar primitive (09-design-system.md §7). Presentational only (CLAUDE.md §4).
 * Shows an image, else initials, else — in the `add` variant — a "+" tile for
 * "Invite more". An optional `online` presence dot is the lobby's functional presence
 * colour; the data (who is present) is supplied by the caller. The web twin of the
 * Phase B mobile Avatar; the "+" is an inline 2px-stroke SVG (no icon dependency).
 */
export function Avatar({
  label,
  imageSrc,
  imageAlt = "",
  online = false,
  variant = "default",
  size = 48,
}: {
  /** Initials / short label shown when there is no image. */
  label?: string;
  imageSrc?: string;
  imageAlt?: string;
  online?: boolean;
  variant?: "default" | "add";
  size?: number;
}) {
  const dimension = { width: size, height: size };
  if (variant === "add") {
    return (
      <div
        role="button"
        aria-label="Invite more"
        style={dimension}
        className="flex items-center justify-center rounded-full border-2 border-dashed border-border bg-surface-raised text-text-muted"
      >
        <PlusIcon size={Math.round(size * 0.45)} />
      </div>
    );
  }
  return (
    <div
      style={dimension}
      className="relative flex items-center justify-center overflow-visible rounded-full bg-surface-sunken"
    >
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={imageAlt}
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        <span className="text-label-md text-text-muted">{label ?? ""}</span>
      )}
      {online ? (
        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-surface bg-online" />
      ) : null}
    </div>
  );
}

function PlusIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
