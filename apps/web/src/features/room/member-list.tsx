import type { RoomMember } from "@munch/core";

import { Avatar } from "@/components/ui";

/**
 * "The Squad" grid (pages.md §3.5): presence-aware member tiles in a 2-column layout, each
 * an Avatar (initials + green `online` dot from isPresent), the display name, and a
 * presence-derived label. The trailing "Invite more" tile fires the caller's share handler.
 * Presentational only — receives the already-mapped RoomMember[] and renders it; no data
 * access or domain logic (CLAUDE.md §4). Only aggregate presence is shown, never per-member
 * swipes (CLAUDE.md §3). Web twin of the Phase B mobile MemberList.
 */
export function MemberList({
  members,
  onInvite,
}: {
  members: RoomMember[];
  onInvite?: () => void;
}) {
  return (
    <ul className="grid grid-cols-2 gap-gutter">
      {members.map((member) => (
        <li
          key={member.id}
          className="flex flex-col items-center gap-xs rounded-md bg-surface px-base py-md shadow-low"
        >
          <Avatar
            label={initials(member.displayName)}
            online={member.isPresent}
          />
          <span className="max-w-full truncate text-body-md text-text">
            {member.displayName}
            {member.role === "host" ? " · host" : ""}
          </span>
          <span className="text-caption text-text-muted">
            {member.isPresent ? "Here" : "Away"}
          </span>
        </li>
      ))}
      {onInvite ? (
        <li className="flex">
          <button
            type="button"
            onClick={onInvite}
            aria-label="Invite more"
            className="flex w-full flex-col items-center justify-center gap-xs rounded-md bg-surface px-base py-md shadow-low transition-transform active:translate-y-[var(--munch-press-translate-y)] motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/40"
          >
            <Avatar variant="add" />
            <span className="text-caption text-text-muted">Invite more</span>
          </button>
        </li>
      ) : null}
    </ul>
  );
}

/** Up to two initials from a display name; falls back to "?" for an empty name. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  if (!first) return "?";
  const last = parts[parts.length - 1];
  if (parts.length === 1 || !last) return first.slice(0, 2).toUpperCase();
  return (first.charAt(0) + last.charAt(0)).toUpperCase();
}
