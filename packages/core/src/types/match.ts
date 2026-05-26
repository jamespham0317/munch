/** How a session was decided: a clean unanimous match, or host acceptance of the top pick. */
export type MatchResolution = "unanimous" | "host_accepted_top";

/**
 * The outcome of a session. Mirrors `matches` (docs/03-database-schema.md §3.8).
 */
export interface Match {
  id: string;
  sessionId: string;
  restaurantId: string;
  resolution: MatchResolution;
  decidedAt: string;
}

/**
 * Durable record of an outcome, kept only for signed-in users. Mirrors
 * `match_history` (docs/03-database-schema.md §3.9). Stores the app's own outcome
 * snapshot — not a durable copy of provider content. Guests get no history row.
 */
export interface MatchHistory {
  id: string;
  userId: string;
  matchId: string;
  restaurantName: string;
  restaurantPhotoUrl: string | null;
  participantNames: string[];
  decidedAt: string;
  createdAt: string;
}
