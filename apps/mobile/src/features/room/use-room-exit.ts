import {
  endRoom,
  type EndRoomResult,
  leaveRoom,
  type LeaveRoomResult,
} from "@munch/api-client";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useRef } from "react";

import { getSupabaseClient } from "../../lib/supabase";

/**
 * The caller's own departure from a room (Phase 4.7, docs/04 §3.10; RN parity with apps/web's
 * useRoomExit). A non-host "Leave room" calls the leave_room RPC — the server removes them (sets
 * left_at, deletes their swipes) and, if that makes the remaining active members unanimous, declares
 * the match immediately; the host "End room" soft-closes the room and cancels any session (no host
 * transfer — CLAUDE.md invariant 3). Both are server-authoritative; the client only routes home
 * afterwards with a "you left" notice.
 *
 * `exitingRef` flips true the instant either mutation starts so the surface's removed-state routing
 * (useRemovedRedirect) stays quiet for a SELF-initiated exit — the user sees "You left the room",
 * not the "You were disconnected" message meant for an external removal.
 */
export function useRoomExit(roomId: string) {
  const router = useRouter();
  const exitingRef = useRef(false);

  const goHome = () => {
    router.replace({ pathname: "/", params: { notice: "left" } });
  };

  const leave = useMutation<LeaveRoomResult, Error, void>({
    mutationFn: async () => {
      exitingRef.current = true;
      const result = await leaveRoom(getSupabaseClient(), roomId);
      if (result.error) {
        exitingRef.current = false;
        throw new Error(result.error.error.message);
      }
      return result.data;
    },
    onSuccess: goHome,
  });

  const end = useMutation<EndRoomResult, Error, void>({
    mutationFn: async () => {
      exitingRef.current = true;
      const result = await endRoom(getSupabaseClient(), roomId);
      if (result.error) {
        exitingRef.current = false;
        throw new Error(result.error.error.message);
      }
      return result.data;
    },
    onSuccess: goHome,
  });

  return { leave, end, exitingRef };
}
