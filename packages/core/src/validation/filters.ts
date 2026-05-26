import { z } from "zod";

import { priceLevelSchema } from "./enums";

/**
 * Host-set filters applied to the whole room (CLAUDE.md §2.2). Members may only
 * narrow within these, never expand beyond them.
 */
export const roomFiltersSchema = z.object({
  open_now: z.boolean(),
  cuisines: z.array(z.string()),
  price_levels: z.array(priceLevelSchema),
});
export type RoomFilters = z.infer<typeof roomFiltersSchema>;
