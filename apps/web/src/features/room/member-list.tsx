import type { RoomMember } from "@munch/core";

/**
 * Presence-aware member list. Presentational only — receives the already-mapped
 * RoomMember[] and renders it; no data access or domain logic (CLAUDE.md §4).
 */
export function MemberList({ members }: { members: RoomMember[] }) {
  if (members.length === 0) {
    return <p>No one here yet.</p>;
  }
  return (
    <ul>
      {members.map((member) => (
        <li key={member.id}>
          <span aria-hidden>{member.isPresent ? "🟢" : "⚪️"}</span>{" "}
          {member.displayName}
          {member.role === "host" ? " · host" : ""}
          {member.isPresent ? "" : " · away"}
        </li>
      ))}
    </ul>
  );
}
