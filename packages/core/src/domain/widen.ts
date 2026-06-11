/**
 * Widen-only host-resolution rule (feature spec §5).
 *
 * When the deck is exhausted with no unanimous match, the host may WIDEN the search
 * (docs/01 §7). A widen may only ever BROADEN the candidate pool, never narrow it: raise
 * the radius, add cuisines / price levels, or clear a restriction to "any". This module is
 * the single source of truth both the resolution UI (to lock/disable controls and as a
 * defensive submit guard) and the resolve-session Edge Function (authoritative reject)
 * agree on (CLAUDE.md §4). The Edge Function runs Deno and can't import the workspace
 * package, so it mirrors these two functions inline — keep them in lockstep (same pattern
 * as the radius bounds duplicated in start-session).
 */

/**
 * A set-valued filter (cuisines or price levels), where an EMPTY array means "no
 * restriction = all values allowed = the widest possible result set" (docs/03 §3.2).
 *
 * Returns true iff the requested set does NOT narrow the result vs the session set — i.e.
 * the requested result set is a superset-or-equal of the session result set:
 *   - requested empty → "any", the broadest set, always broader-or-equal;
 *   - session empty & requested non-empty → restricting the already-unrestricted = NARROWS;
 *   - otherwise → requested must contain every session value (a superset).
 */
export function setFilterIsBroaderOrEqual(
  sessionSet: readonly string[],
  requestedSet: readonly string[],
): boolean {
  if (requestedSet.length === 0) return true;
  if (sessionSet.length === 0) return false;
  const requested = new Set(requestedSet);
  return sessionSet.every((value) => requested.has(value));
}

/** The session's snapshotted filters a widen request is measured against. */
export interface WidenSnapshot {
  radiusM: number;
  openNow: boolean;
  cuisines: readonly string[];
  priceLevels: readonly string[];
}

/** The effective filters a widen request resolves to (after snapshot fallbacks). */
export type WidenRequestEffective = WidenSnapshot;

/**
 * True iff EVERY dimension of the requested widen broadens-or-equals the session snapshot
 * (feature spec §5). The check is per-dimension: a wider radius never "pays for" a removed
 * cuisine. `openNow` is locked — a widen may not change it (the include-closed loosen is
 * out of scope this round, so any change to it is treated as narrowing).
 */
export function isNonNarrowingWiden(
  session: WidenSnapshot,
  requested: WidenRequestEffective,
): boolean {
  return (
    requested.radiusM >= session.radiusM &&
    requested.openNow === session.openNow &&
    setFilterIsBroaderOrEqual(session.cuisines, requested.cuisines) &&
    setFilterIsBroaderOrEqual(session.priceLevels, requested.priceLevels)
  );
}
