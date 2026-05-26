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
