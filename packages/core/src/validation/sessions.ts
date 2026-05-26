import { z } from "zod";

import { latSchema, lngSchema, radiusMSchema } from "./common";
import { priceLevelSchema, sessionStatusSchema } from "./enums";
import { roomFiltersSchema } from "./filters";
import { matchInfoSchema } from "./matches";

/**
 * Request/response schemas for the session endpoints in
 * docs/04-api-specification.md §3.5–§3.6, §3.8–§3.9. Wire shapes are snake_case.
 */

// 3.5 start_session (host only)
export const startSessionRequestSchema = z.object({
  radius_m: radiusMSchema,
});
export type StartSessionRequest = z.infer<typeof startSessionRequestSchema>;

export const startSessionResponseSchema = z.object({
  session: z.object({
    id: z.uuid(),
    status: sessionStatusSchema,
    radius_m: radiusMSchema,
  }),
  deck_size: z.number().int().min(0),
});
export type StartSessionResponse = z.infer<typeof startSessionResponseSchema>;

// 3.6 get_deck
export const getDeckRequestSchema = z.object({ session_id: z.uuid() });
export type GetDeckRequest = z.infer<typeof getDeckRequestSchema>;

/** A single card in the cached deck; `distance_m` is computed from the room anchor. */
export const deckRestaurantSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  lat: latSchema,
  lng: lngSchema,
  rating: z.number().nullable(),
  price_level: priceLevelSchema.nullable(),
  cuisines: z.array(z.string()),
  photo_url: z.url().nullable(),
  is_open_now: z.boolean().nullable(),
  distance_m: z.number().min(0),
});
export type DeckRestaurant = z.infer<typeof deckRestaurantSchema>;

export const getDeckResponseSchema = z.object({
  restaurants: z.array(deckRestaurantSchema),
});
export type GetDeckResponse = z.infer<typeof getDeckResponseSchema>;

// 3.8 get_resolution_ranking (host)
export const getResolutionRankingRequestSchema = z.object({
  session_id: z.uuid(),
});
export type GetResolutionRankingRequest = z.infer<
  typeof getResolutionRankingRequestSchema
>;

/** Ordered by pass_count asc, then rating desc, then distance_m asc (CLAUDE.md §2.4). */
export const rankingEntrySchema = z.object({
  restaurant_id: z.uuid(),
  name: z.string(),
  pass_count: z.number().int().min(0),
  like_count: z.number().int().min(0),
  member_count: z.number().int().min(0),
  rating: z.number().nullable(),
  distance_m: z.number().min(0),
});
export type RankingEntry = z.infer<typeof rankingEntrySchema>;

export const getResolutionRankingResponseSchema = z.object({
  ranking: z.array(rankingEntrySchema),
});
export type GetResolutionRankingResponse = z.infer<
  typeof getResolutionRankingResponseSchema
>;

// 3.9 resolve_session (host only) — accept the top pick or widen criteria.
export const resolveSessionAcceptRequestSchema = z.object({
  session_id: z.uuid(),
  action: z.literal("accept_top"),
  restaurant_id: z.uuid(),
});

export const resolveSessionWidenRequestSchema = z.object({
  session_id: z.uuid(),
  action: z.literal("widen"),
  radius_m: radiusMSchema.optional(),
  filters: roomFiltersSchema.partial().optional(),
});

export const resolveSessionRequestSchema = z.discriminatedUnion("action", [
  resolveSessionAcceptRequestSchema,
  resolveSessionWidenRequestSchema,
]);
export type ResolveSessionRequest = z.infer<typeof resolveSessionRequestSchema>;

export const resolveSessionAcceptResponseSchema = z.object({
  session: z.object({ status: sessionStatusSchema }),
  match: matchInfoSchema,
});

export const resolveSessionWidenResponseSchema = z.object({
  session: z.object({ status: sessionStatusSchema }),
  new_restaurants: z.number().int().min(0),
});

export const resolveSessionResponseSchema = z.union([
  resolveSessionAcceptResponseSchema,
  resolveSessionWidenResponseSchema,
]);
export type ResolveSessionResponse = z.infer<
  typeof resolveSessionResponseSchema
>;
