import type { Restaurant } from "@munch/core";
import type { SupabaseClient } from "@supabase/supabase-js";

import { type ClientResult, toApiError } from "./errors";

/**
 * Phase 0 connectivity smoke read.
 *
 * Fetches the single seeded `restaurants` row (supabase/seed/seed.sql) under RLS
 * and maps its snake_case columns to the camelCase core `Restaurant` type — this
 * is the snake_case→camelCase boundary (docs/06 §5). Proves: anon auth works, RLS
 * permits the read, and the monorepo → api-client → Supabase path is wired.
 *
 * TODO(Phase 1): remove with the permissive `restaurants_select_phase0_smoke`
 * policy once restaurant reads are scoped to a session's deck membership.
 */

/** Fixed id of the seeded smoke row (see supabase/seed/seed.sql). */
const SMOKE_RESTAURANT_ID = "00000000-0000-0000-0000-0000000000a1";

const RESTAURANT_COLUMNS =
  "id, provider, provider_ref, name, lat, lng, rating, price_level, cuisines, photo_url, is_open_now, fetched_at, expires_at";

/**
 * Raw `restaurants` row as returned by PostgREST (snake_case). There are no
 * generated DB types in Phase 0, so the row is typed explicitly here.
 */
interface RestaurantRow {
  id: string;
  provider: string;
  provider_ref: string;
  name: string;
  lat: number;
  lng: number;
  rating: number | null;
  price_level: Restaurant["priceLevel"];
  cuisines: string[];
  photo_url: string | null;
  is_open_now: boolean | null;
  fetched_at: string;
  expires_at: string;
}

function mapRestaurantRow(row: RestaurantRow): Restaurant {
  return {
    id: row.id,
    provider: row.provider,
    providerRef: row.provider_ref,
    name: row.name,
    lat: row.lat,
    lng: row.lng,
    rating: row.rating,
    priceLevel: row.price_level,
    cuisines: row.cuisines,
    photoUrl: row.photo_url,
    isOpenNow: row.is_open_now,
    fetchedAt: row.fetched_at,
    expiresAt: row.expires_at,
  };
}

/** Fetch the seeded smoke-test restaurant under RLS, mapped to the core type. */
export async function fetchSmokeRestaurant(
  client: SupabaseClient,
): Promise<ClientResult<Restaurant>> {
  const result = await client
    .from("restaurants")
    .select(RESTAURANT_COLUMNS)
    .eq("id", SMOKE_RESTAURANT_ID)
    .limit(1)
    .returns<RestaurantRow[]>();

  if (result.error) {
    return { data: null, error: toApiError(result.error) };
  }
  const row = result.data[0];
  if (!row) {
    // The Phase 0 seed wasn't applied — run `supabase db reset`.
    return { data: null, error: toApiError(null) };
  }
  return { data: mapRestaurantRow(row), error: null };
}
