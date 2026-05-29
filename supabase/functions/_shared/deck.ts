// _shared/deck.ts
// Shared restaurant-cache helpers used by every Edge Function that writes the
// per-session pool: start-session (the initial fetch, added_round = 0) and
// resolve-session's widen action (a later round, added_round = n+1). These were
// originally inline in start-session/index.ts and are extracted here so the widen
// round reuses the exact same upsert + cached-deck semantics (CLAUDE.md §4 — no
// duplicated domain plumbing).
//
// Deno-friendly by design: this module imports ONLY the Edge-side EdgeError and the
// provider's NormalizedRestaurant type — never @munch/core (cross-runtime ESM imports
// of the workspace packages aren't wired up for Deno; same convention as the rest of
// supabase/functions/).

import { EdgeError } from "./errors.ts";
import type { NormalizedRestaurant } from "./provider/index.ts";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Provider TTL for the `restaurants.expires_at` column. Conservative 24h under
 *  typical provider caching terms (CLAUDE.md §3); a row rediscovered by a later
 *  session/round keeps the new TTL — strictly conservative, never shortens below it. */
export const RESTAURANT_TTL_MS = 24 * 60 * 60 * 1000;

interface RestaurantInsertRow extends NormalizedRestaurant {
  expires_at: string;
}

/**
 * Upsert restaurants by (provider, provider_ref). The Postgres unique index lives on
 * (provider, provider_ref) (0002/0013), so the conflict target is exact. supabase-js
 * .upsert() can't express a conditional on-conflict, so we just write the new expires_at
 * and accept that the TTL "resets" each time a session re-fetches a restaurant — strictly
 * conservative under provider caching terms (CLAUDE.md §3).
 *
 * Returns the inserted/updated restaurant ids in INPUT order (supabase upsert doesn't
 * guarantee the return order matches the input, so we re-align via provider_ref).
 */
export async function upsertRestaurants(
  admin: SupabaseClient,
  places: NormalizedRestaurant[],
  ttlMs: number,
): Promise<string[]> {
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  const rows: RestaurantInsertRow[] = places.map((p) => ({
    ...p,
    expires_at: expiresAt,
  }));
  const { data, error } = await admin
    .from("restaurants")
    .upsert(rows, { onConflict: "provider,provider_ref" })
    .select("id, provider_ref");
  if (error || !data) throw new EdgeError("VALIDATION_ERROR", error);
  const byRef = new Map<string, string>();
  for (const r of data as { id: string; provider_ref: string }[]) {
    byRef.set(r.provider_ref, r.id);
  }
  const ids: string[] = [];
  for (const p of places) {
    const id = byRef.get(p.provider_ref);
    if (id) ids.push(id);
  }
  return ids;
}

/**
 * Append restaurants to a session's cached deck at the given `addedRound` (0 at session
 * start, n+1 per widen round). `do nothing` on conflict — a safety belt against a
 * duplicate id slipping through (cached_decks has a unique (session_id, restaurant_id),
 * 0002). For widen, callers pass only NEWLY-fetched places, so the conflict guard is
 * belt-and-suspenders behind the provider's excludeProviderRefs.
 */
export async function insertCachedDeck(
  admin: SupabaseClient,
  sessionId: string,
  restaurantIds: string[],
  addedRound: number,
): Promise<void> {
  const rows = restaurantIds.map((restaurant_id) => ({
    session_id: sessionId,
    restaurant_id,
    added_round: addedRound,
  }));
  const { error } = await admin.from("cached_decks").upsert(rows, {
    onConflict: "session_id,restaurant_id",
    ignoreDuplicates: true,
  });
  if (error) throw new EdgeError("VALIDATION_ERROR", error);
}
