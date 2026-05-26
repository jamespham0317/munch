/**
 * Enum unions mirroring the Postgres enum types in docs/03-database-schema.md §2.
 * These are the single source of truth for the app; do not redefine them in apps.
 */

export type SessionStatus =
  | "lobby"
  | "active"
  | "awaiting_host_resolution"
  | "matched"
  | "resolved"
  | "cancelled";

export type SwipeDecision = "like" | "pass";

/** Provider price level, `$` (`"1"`) through `$$$$` (`"4"`). */
export type PriceLevel = "1" | "2" | "3" | "4";

export type MemberRole = "host" | "member";
