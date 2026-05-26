import type { PriceLevel, SessionStatus } from "./enums";

/**
 * One round of swiping toward a decision. Mirrors `sessions`
 * (docs/03-database-schema.md §3.4). Filters/radius are snapshotted at start so
 * later room edits don't mutate an in-flight session.
 */
export interface Session {
  id: string;
  roomId: string;
  status: SessionStatus;
  radiusM: number;
  filterOpenNow: boolean;
  filterCuisines: string[];
  filterPriceLevels: PriceLevel[];
  startedAt: string | null;
  endedAt: string | null;
  matchedRestaurantId: string | null;
  createdAt: string;
}
