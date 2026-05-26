/**
 * Closest-to-unanimous ranking for host resolution.
 *
 * Tiebreak order is LOAD-BEARING (CLAUDE.md §2.4) — rank by how close a restaurant
 * came to a unanimous like, NOT by raw like count:
 *   1. fewest passes
 *   2. highest rating
 *   3. nearest distance
 *
 * TODO(Phase 3): expand alongside the server ranking RPC and add thorough tests
 * (ties at each level, deck exhaustion, missing ratings).
 */

export interface ResolutionRankingEntry {
  restaurantId: string;
  /** Number of present members who passed on this restaurant. */
  passCount: number;
  rating: number | null;
  /** Distance from the room anchor, in metres. */
  distanceM: number;
}

/**
 * Return a new array of entries ordered closest-to-unanimous first. Pure: the
 * input is not mutated. The first element is the host's suggested pick.
 */
export function rankByClosestToUnanimous<T extends ResolutionRankingEntry>(
  entries: readonly T[],
): T[] {
  return [...entries].sort((a, b) => {
    if (a.passCount !== b.passCount) return a.passCount - b.passCount;
    const ratingA = a.rating ?? Number.NEGATIVE_INFINITY;
    const ratingB = b.rating ?? Number.NEGATIVE_INFINITY;
    if (ratingA !== ratingB) return ratingB - ratingA;
    return a.distanceM - b.distanceM;
  });
}
