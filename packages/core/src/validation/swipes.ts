import { z } from "zod";

import { swipeDecisionSchema } from "./enums";
import { matchInfoSchema } from "./matches";

/**
 * Request/response schemas for `submit_swipe` (docs/04-api-specification.md §3.7).
 * The authoritative match check runs server-side; `match` is non-null only when the
 * server has declared a match (CLAUDE.md §2.3).
 */

export const submitSwipeRequestSchema = z.object({
  session_id: z.uuid(),
  restaurant_id: z.uuid(),
  decision: swipeDecisionSchema,
});
export type SubmitSwipeRequest = z.infer<typeof submitSwipeRequestSchema>;

export const submitSwipeResponseSchema = z.object({
  recorded: z.boolean(),
  match: matchInfoSchema.nullable(),
});
export type SubmitSwipeResponse = z.infer<typeof submitSwipeResponseSchema>;
