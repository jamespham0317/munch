"use client";

import { InvitePanel } from "./invite-panel";
import { MemberList } from "./member-list";
import { useRoomLobby } from "./use-room-lobby";

/**
 * Room lobby: an initial getRoom + getRoomMembers read kept live by subscribeRoom,
 * an invite affordance, and the host-only "Start session" placeholder (Phase 2).
 * Screens stay thin — all data access is in @munch/api-client (CLAUDE.md §4).
 */
export function LobbyView({ roomId }: { roomId: string }) {
  const { roomQuery, membersQuery, currentUserId } = useRoomLobby(roomId);

  if (roomQuery.isPending || membersQuery.isPending) {
    return <p>Loading lobby…</p>;
  }
  if (roomQuery.isError) {
    return <p role="alert">{roomQuery.error.message}</p>;
  }
  if (membersQuery.isError) {
    return <p role="alert">{membersQuery.error.message}</p>;
  }

  const room = roomQuery.data;
  const members = membersQuery.data;
  const me = currentUserId
    ? members.find((member) => member.userId === currentUserId)
    : undefined;
  const isHost = me?.role === "host";

  return (
    <section>
      <InvitePanel code={room.code} />
      <h2>Members</h2>
      <MemberList members={members} />
      {isHost ? (
        <button type="button" disabled title="Available in Phase 2">
          Start session (Phase 2)
        </button>
      ) : (
        <p>Waiting for the host to start the session…</p>
      )}
    </section>
  );
}
