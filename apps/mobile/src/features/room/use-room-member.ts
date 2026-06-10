import { getRoomMembers } from "@munch/api-client";
import type { RoomMember } from "@munch/core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useMemo } from "react";

import { getSupabaseClient } from "../../lib/supabase";
import { useCurrentUser } from "../auth/use-current-user";

/**
 * Resolve the caller's own ACTIVE member row for a room (RN parity with apps/web's useRoomMember;
 * CLAUDE.md §4 — no domain logic, just the lookup every room surface shares). getRoomMembers returns
 * only active members (left_at IS NULL, Phase 4.7), so a member who left or was auto-removed drops
 * out of `members` and `member` goes null — that absence is how a surface detects its own removal
 * (see useRemovedRedirect).
 *
 * The query dedupes through the `["room-members", roomId]` key the lobby + swipe screens already
 * use, so calling this in several places costs one fetch. `settled` is true once both the member
 * read and the auth read have resolved — callers gate removed-state routing on it so they never
 * misread the initial loading window as a removal.
 */

export const membersKey = (roomId: string) => ["room-members", roomId] as const;

async function fetchMembers(roomId: string): Promise<RoomMember[]> {
  const result = await getRoomMembers(getSupabaseClient(), roomId);
  if (result.error) {
    throw new Error(result.error.error.message);
  }
  return result.data;
}

export interface RoomMemberLookup {
  /** The active member list query — callers render their own loading/error from it. */
  membersQuery: UseQueryResult<RoomMember[], Error>;
  /** The caller's own active member row, or null if absent (not yet loaded, or removed). */
  member: RoomMember | null;
  memberId: string | null;
  isHost: boolean;
  /** True once both the member list and the auth identity have settled (not pending). */
  settled: boolean;
}

export function useRoomMember(roomId: string): RoomMemberLookup {
  const membersQuery = useQuery<RoomMember[], Error>({
    queryKey: membersKey(roomId),
    queryFn: () => fetchMembers(roomId),
    retry: false,
  });
  const userQuery = useCurrentUser();

  const member = useMemo(() => {
    const userId = userQuery.data?.id;
    if (!userId || !membersQuery.data) return null;
    return membersQuery.data.find((m) => m.userId === userId) ?? null;
  }, [membersQuery.data, userQuery.data]);

  return {
    membersQuery,
    member,
    memberId: member?.id ?? null,
    isHost: member?.role === "host",
    settled: !membersQuery.isPending && !userQuery.isPending,
  };
}
