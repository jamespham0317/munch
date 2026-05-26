import type { SwipeDecision } from "./enums";

/**
 * A member's decision on one restaurant in a session. Mirrors `swipes`
 * (docs/03-database-schema.md §3.7). Session-scoped and never exposed to other
 * members beyond aggregate progress.
 */
export interface Swipe {
  id: string;
  sessionId: string;
  memberId: string;
  restaurantId: string;
  decision: SwipeDecision;
  createdAt: string;
}
