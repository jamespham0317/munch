import { z } from "zod";

import { sessionStatusSchema } from "./enums";
import { matchInfoSchema } from "./matches";
import { deckRestaurantSchema } from "./sessions";

/**
 * Payload schemas for the `session:{session_id}` realtime channel events in
 * docs/04-api-specification.md §4. Wire shapes are snake_case; the api-client
 * maps to camelCase at its boundary (docs/06 §5). Realtime is only a
 * notification of state — the authoritative match is declared server-side
 * (CLAUDE.md §2.3).
 */

/** Session status transition (`lobby → active → matched/cancelled`, etc.). */
export const sessionStatusChangeSchema = z.object({
  session_id: z.uuid(),
  status: sessionStatusSchema,
});
export type SessionStatusChange = z.infer<typeof sessionStatusChangeSchema>;

/**
 * Match announcement event. `restaurant` reuses `deckRestaurantSchema` so the
 * result screen has the same card shape the deck already exposed.
 */
export const sessionMatchEventSchema = z.object({
  session_id: z.uuid(),
  match: matchInfoSchema,
  restaurant: deckRestaurantSchema,
});
export type SessionMatchEvent = z.infer<typeof sessionMatchEventSchema>;
