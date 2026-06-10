/**
 * Unanimous-match logic.
 *
 * This is the optimistic client-side MIRROR of the match check only. The
 * AUTHORITATIVE check runs server-side in a transaction (docs/03 §5,
 * docs/04 §3.7) and is what actually declares a match (CLAUDE.md §2.3);
 * clients must never declare a match from this.
 */

export interface UnanimousCheckInput {
  /**
   * Ids of the room's ACTIVE members — those with `room_members.left_at IS NULL`
   * at the moment of the check. Membership changes (a leave or disconnect
   * auto-removal) change the cohort this function evaluates against; the server
   * RPC re-evaluates the same way (CLAUDE.md §2.3, docs/02 §5). Cosmetic Here/Away
   * never affects this set.
   */
  activeMemberIds: readonly string[];
  /** Ids of members who have liked the restaurant in question. */
  likerMemberIds: readonly string[];
}

/**
 * Pure check: true iff there is at least one active member and every active
 * member has liked the restaurant. Mirrors the SQL in docs/03-database-schema.md
 * §5. The empty-cohort case returns false deliberately (no vacuous match).
 */
export function isUnanimousLike({
  activeMemberIds,
  likerMemberIds,
}: UnanimousCheckInput): boolean {
  if (activeMemberIds.length === 0) return false;
  const likers = new Set(likerMemberIds);
  return activeMemberIds.every((id) => likers.has(id));
}
