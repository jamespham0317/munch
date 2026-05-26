/**
 * Unanimous-match logic.
 *
 * This is the optimistic client-side MIRROR of the match check only. The
 * AUTHORITATIVE check runs server-side in a transaction and is what actually
 * declares a match (CLAUDE.md §2.3); clients must never declare a match from this.
 * "Every member" is relative to currently present members.
 *
 * TODO(Phase 2): expand alongside the server RPC and add thorough tests
 * (ties, a member leaving mid-session, deck exhaustion with no match).
 */

export interface UnanimousCheckInput {
  /** Ids of members currently present in the session. */
  presentMemberIds: readonly string[];
  /** Ids of members who have liked the restaurant in question. */
  likerMemberIds: readonly string[];
}

/**
 * True when there is at least one present member and every present member has
 * liked the restaurant. Mirrors the SQL in docs/03-database-schema.md §5.
 */
export function isUnanimousLike({
  presentMemberIds,
  likerMemberIds,
}: UnanimousCheckInput): boolean {
  if (presentMemberIds.length === 0) return false;
  const likers = new Set(likerMemberIds);
  return presentMemberIds.every((id) => likers.has(id));
}
