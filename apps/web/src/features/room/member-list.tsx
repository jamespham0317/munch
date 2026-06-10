import type { RoomMember } from "@munch/core";

import { Avatar } from "@/components/ui";

/**
 * "The Squad" grid (10-pages.md §3.5): the ACTIVE roster in a 2-column layout, each an Avatar
 * (initials + green dot) plus the display name and a Here/Away label. Presence is COSMETIC
 * (Phase 4.7): the dot/label come from the Realtime Presence map (`focused`), never from a DB
 * field and never read by matchmaking (CLAUDE.md §2.3/§3). A focused member shows the green dot +
 * "Here"; a connected-but-unfocused or briefly-absent member shows no dot + "Away" but stays
 * listed as long as they're an active member (a member who left is excluded upstream by
 * getRoomMembers). Presentational only — no data access or domain logic (CLAUDE.md §4). Web twin
 * of the Phase B mobile MemberList.
 */
export function MemberList({
  members,
  presence,
  onInvite,
}: {
  members: RoomMember[];
  /** Cosmetic Realtime Presence, keyed by member id; absence ⇒ no dot, "Away". */
  presence: Map<string, { focused: boolean }>;
  onInvite?: () => void;
}) {
  return (
    <ul className="grid grid-cols-2 gap-gutter">
      {members.map((member) => {
        const focused = presence.get(member.id)?.focused ?? false;
        return (
          <li
            key={member.id}
            className="flex flex-col items-center gap-xs rounded-md bg-surface px-base py-md shadow-low"
          >
            <Avatar label={initials(member.displayName)} online={focused} />
            <span className="max-w-full truncate text-body-md text-text">
              {member.displayName}
              {member.role === "host" ? " · host" : ""}
            </span>
            <span className="text-caption text-text-muted">
              {focused ? "Here" : "Away"}
            </span>
          </li>
        );
      })}
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
