import { z } from "zod";

/**
 * Zod mirrors of the domain enum unions (see `src/types/enums.ts`). Values match
 * the Postgres enums in docs/03-database-schema.md §2 exactly.
 */

export const sessionStatusSchema = z.enum([
  "lobby",
  "active",
  "awaiting_host_resolution",
  "matched",
  "resolved",
  "cancelled",
]);

export const swipeDecisionSchema = z.enum(["like", "pass"]);

export const priceLevelSchema = z.enum(["1", "2", "3", "4"]);

export const memberRoleSchema = z.enum(["host", "member"]);

/** Not a Postgres enum (text column), but a known set — see `MatchResolution`. */
export const matchResolutionSchema = z.enum(["unanimous", "host_accepted_top"]);
