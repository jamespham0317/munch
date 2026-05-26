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
