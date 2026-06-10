import { useRouter } from "expo-router";
import { type RefObject, useEffect, useRef } from "react";

/**
 * Route the caller home when they're removed from a room by something OTHER than their own action
 * (an auto-removal after a dropped connection past the grace window, or a host ending the room),
 * Phase 4.7 (RN parity with apps/web's useRemovedRedirect). Removal surfaces as the caller's own
 * member row leaving the ACTIVE list (getRoomMembers filters left_at IS NULL) — i.e. `memberId`
 * going null after we'd seen it.
 *
 * Guards against false positives: it only fires once the member read has `settled` (never during
 * the initial loading window) and only if we'd previously resolved a member id. `suppressedRef`
 * (the exit hook's flag) silences it for a SELF-initiated leave/end so that path keeps its own
 * "You left the room" notice instead of "You were disconnected".
 */
export function useRemovedRedirect(opts: {
  memberId: string | null;
  settled: boolean;
  suppressedRef: RefObject<boolean>;
}): void {
  const { memberId, settled, suppressedRef } = opts;
  const router = useRouter();
  const wasMember = useRef(false);

  useEffect(() => {
    if (memberId) {
      wasMember.current = true;
      return;
    }
    if (!settled || suppressedRef.current || !wasMember.current) return;
    router.replace({ pathname: "/", params: { notice: "disconnected" } });
  }, [memberId, settled, suppressedRef, router]);
}
