import { z } from "zod";

import { matchResolutionSchema } from "./enums";

/**
 * The match payload returned by `submit_swipe` (3.7) and `resolve_session` (3.9).
 * `restaurant_name` is present on the swipe path and omitted on accept.
 */
export const matchInfoSchema = z.object({
  restaurant_id: z.uuid(),
  restaurant_name: z.string().optional(),
  resolution: matchResolutionSchema,
});
export type MatchInfo = z.infer<typeof matchInfoSchema>;

/**
 * The wire shape of one `match_history` row (snake_case; docs/03 §3.9). This is the
 * read contract for the history screen; the api-client maps it to the camelCase
 * `MatchHistory` type (docs/06 §5). Written only for signed-in members (CLAUDE.md §3).
 */
export const matchHistoryEntrySchema = z.object({
  id: z.uuid(),
  match_id: z.uuid(),
  restaurant_name: z.string(),
  restaurant_photo_url: z.url().nullable(),
  participant_names: z.array(z.string()),
  decided_at: z.string(),
  created_at: z.string(),
});
export type MatchHistoryEntry = z.infer<typeof matchHistoryEntrySchema>;

export const getMatchHistoryResponseSchema = z.object({
  history: z.array(matchHistoryEntrySchema),
});
export type GetMatchHistoryResponse = z.infer<
  typeof getMatchHistoryResponseSchema
>;
