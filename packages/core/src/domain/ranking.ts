/**
 * Closest-to-unanimous ranking for host resolution.
 *
 * Tiebreak order is LOAD-BEARING (CLAUDE.md §2.4) — rank by how close a restaurant
 * came to a unanimous like, NOT by raw like count:
 *   1. fewest passes
 *   2. highest rating
 *   3. nearest distance
 *
 * Pass (and like) counts are scoped to the ACTIVE members (`left_at IS NULL`) —
 * the same cohort the unanimous check evaluates against (see `matching.ts` and
 * CLAUDE.md §2.3). The authoritative ranking runs server-side in
 * `get_resolution_ranking` (docs/04 §3.8); this is the shared sort the server and
 * clients agree on.
 */

export interface ResolutionRankingEntry {
  restaurantId: string;
  /** Number of active members who passed on this restaurant. */
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
