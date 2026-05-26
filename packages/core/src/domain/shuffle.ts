/**
 * Deterministic, seeded deck shuffle.
 *
 * All members swipe the same cached pool (CLAUDE.md §2.2); each member sees it in
 * their own order, derived deterministically from `memberId + sessionId` so the
 * order need not be stored (docs/03-database-schema.md §3.6). The same seed always
 * yields the same order, and a different member yields a different order.
 */

/** FNV-1a 32-bit string hash → an unsigned 32-bit seed for the PRNG. */
function hashSeed(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32: a small, fast PRNG returning a float in [0, 1) from a 32-bit seed. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface ShuffleSeed {
  memberId: string;
  sessionId: string;
}

/**
 * Return a new array containing `items` in a deterministic shuffled order for the
 * given seed. Pure: the input array is not mutated.
 */
export function shuffleDeck<T>(items: readonly T[], seed: ShuffleSeed): T[] {
  const rng = mulberry32(hashSeed(`${seed.memberId}:${seed.sessionId}`));
  const result = [...items];
  // Fisher–Yates.
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = result[i] as T;
    result[i] = result[j] as T;
    result[j] = tmp;
  }
  return result;
}
