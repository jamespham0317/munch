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
   * Ids of members currently present in the session — i.e. those with
   * `room_members.is_present = true` at the moment of the check. A member
   * toggling presence mid-session changes the cohort this function evaluates
   * against; the server RPC re-evaluates the same way on every call (CLAUDE.md
   * §2.3, docs/02 §5).
   */
  presentMemberIds: readonly string[];
  /** Ids of members who have liked the restaurant in question. */
  likerMemberIds: readonly string[];
}

/**
 * Pure check: true iff there is at least one present member and every present
 * member has liked the restaurant. Mirrors the SQL in docs/03-database-schema.md
 * §5. The empty-cohort case returns false deliberately (no vacuous match).
 */
export function isUnanimousLike({
  presentMemberIds,
  likerMemberIds,
}: UnanimousCheckInput): boolean {
  if (presentMemberIds.length === 0) return false;
  const likers = new Set(likerMemberIds);
  return presentMemberIds.every((id) => likers.has(id));
}
