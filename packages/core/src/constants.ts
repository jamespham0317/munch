/**
 * Shared domain constants. Bounds are validated by the Zod schemas in
 * `src/validation` so client and server agree on the same limits.
 */

/** Restaurant-pool search radius bounds, in metres. */
export const RADIUS_MIN_M = 500;
export const RADIUS_MAX_M = 20_000;
/** Default starting radius for the host's slider (docs/03 `rooms.default_radius_m`). */
export const DEFAULT_RADIUS_M = 3_000;

/** A room holds between 2 and 10 members (docs/01 product spec). */
export const ROOM_SIZE_MIN = 2;
export const ROOM_SIZE_MAX = 10;

/** Join codes are 6 digits (docs/04 `create_room`). */
export const JOIN_CODE_LENGTH = 6;

/**
 * Closed v1 cuisine taxonomy. The single source of truth for the host's cuisine
 * picker (web + mobile) AND the server's cuisine→Google-type mapping in
 * `supabase/functions/_shared/normalize.ts` (Prompt 3 reconciles that map to these
 * ids). Ids are lowercase-kebab so they are stable map keys; the list is CLOSED —
 * there is no free-text cuisine input. Dietary filters (veg/vegan/halal/gluten-free)
 * and per-member "narrow" filters are deferred (roadmap §8); do not add them here.
 */
export const CUISINES = [
  { id: "italian", label: "Italian" },
  { id: "japanese", label: "Japanese" },
  { id: "chinese", label: "Chinese" },
  { id: "mexican", label: "Mexican" },
  { id: "thai", label: "Thai" },
  { id: "indian", label: "Indian" },
  { id: "american", label: "American" },
  { id: "mediterranean", label: "Mediterranean" },
  { id: "korean", label: "Korean" },
  { id: "vietnamese", label: "Vietnamese" },
  { id: "pizza", label: "Pizza" },
  { id: "sushi", label: "Sushi" },
  { id: "cafe", label: "Cafe" },
  { id: "dessert", label: "Dessert" },
] as const satisfies readonly { id: string; label: string }[];

/** A cuisine id from the closed {@link CUISINES} taxonomy. */
export type CuisineId = (typeof CUISINES)[number]["id"];

/**
 * Look up a cuisine's display label by id. Falls back to the raw id for an unknown
 * value so a stale/foreign id still renders something rather than crashing.
 */
export function cuisineLabel(id: string): string {
  return CUISINES.find((c) => c.id === id)?.label ?? id;
}
