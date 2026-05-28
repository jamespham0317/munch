// _shared/provider/index.ts
// The provider abstraction boundary. All restaurant data fetching goes through this
// interface (docs/02 §3.3, docs/04 §5, CLAUDE.md §4); a future Yelp/Foursquare
// implementation slots in beside google-places.ts without any caller change.
//
// SECURITY (CLAUDE.md §3): this file and its implementations live ONLY under
// supabase/functions/_shared and are imported ONLY by Edge Functions. The provider
// API key is read from Edge Function env (PROVIDER_GOOGLE_API_KEY) and never
// surfaces to apps/* or packages/*. The Phase-0 CI guard (scripts/check-secrets.sh)
// enforces this.

import { GooglePlacesProvider } from "./google-places.ts";

/**
 * App-normalized restaurant shape. Snake_case fields map 1:1 to the `restaurants`
 * table columns (docs/03 §3.5) MINUS `id`/`fetched_at`/`expires_at` (those are
 * server-assigned at insert/upsert time). This is intentionally NOT a re-import of
 * @munch/core's camelCase `Restaurant` — Edge Functions are Deno and cross-runtime
 * ESM imports of the workspace packages aren't wired up, and we want the wire shape
 * the upsert speaks anyway. Keep this in lockstep with `restaurants` (0002 + 0009).
 */
export interface NormalizedRestaurant {
  provider: string;
  provider_ref: string;
  name: string;
  lat: number;
  lng: number;
  rating: number | null;
  /** `'1'..'4'` per the price_level enum (0001); null when the provider didn't say. */
  price_level: "1" | "2" | "3" | "4" | null;
  cuisines: string[];
  /**
   * Phase 2: ALWAYS null. The provider's photo URL requires the server-only API key
   * to fetch, so we can't ship it to clients without a photo-proxy Edge Function.
   * The web/mobile swipe screens render a placeholder this phase. Lifting the
   * restriction is a follow-up (proxy endpoint + here we'd return its URL).
   */
  photo_url: string | null;
  is_open_now: boolean | null;
}

/** Parameters for a single provider fetch — one per session start, one per widen round. */
export interface FetchRestaurantsParams {
  lat: number;
  lng: number;
  radiusM: number;
  openNow: boolean;
  cuisines: string[];
  priceLevels: ("1" | "2" | "3" | "4")[];
  /** Phase 3 widen: skip already-seen places. Phase 2 passes [] / undefined. */
  excludeProviderRefs?: string[];
}

/**
 * Single restaurant data provider interface (docs/04 §5). One method by design —
 * a provider either fetches the pool for an anchor+filters+radius or it doesn't.
 * Implementations must throw a `ProviderError` (not the raw provider response) on
 * any failure path so the Edge Function maps cleanly to PROVIDER_ERROR.
 */
export interface RestaurantProvider {
  fetchRestaurants(
    params: FetchRestaurantsParams,
  ): Promise<NormalizedRestaurant[]>;
}

/**
 * Factory: returns the configured provider implementation for this deployment.
 * Phase 2: always GooglePlacesProvider. The `PROVIDER=fake` hook for the FakeProvider
 * used in Prompt-7 integration tests lands when that file exists — the env flag is
 * read here so production deployment env (which doesn't set it) always gets the real
 * provider. Future providers swap here, nowhere else (docs/02 §3.3, docs/04 §5).
 */
export function getProvider(): RestaurantProvider {
  return new GooglePlacesProvider();
}
