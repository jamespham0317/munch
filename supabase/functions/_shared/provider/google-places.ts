// _shared/provider/google-places.ts
// GooglePlacesProvider — Phase 2's only RestaurantProvider implementation. Uses
// Google Places API v1 Nearby Search (POST .../v1/places:searchNearby with
// X-Goog-Api-Key + X-Goog-FieldMask). The choice of v1 over the legacy endpoint
// keeps the field-mask compact and matches the rest of Google's current API
// surface; the abstraction (provider/index.ts) means the choice can change
// without touching callers.
//
// TODO(pricing/ToS): exact per-call price and caching constraints must be
// re-verified on Google's own pricing page before launch — CLAUDE.md §9 keeps
// numbers OUT of code. The v1 Nearby Search SKU is the current target.
//
// SECURITY (CLAUDE.md §3): PROVIDER_GOOGLE_API_KEY is read from Edge Function env
// ONLY. It never appears in apps/* or packages/* (the Phase-0 CI guard enforces
// this). On any non-2xx / throw we raise a `ProviderError` — the raw provider
// response body is logged but NEVER surfaced to clients (docs/06 §8/§9).

import { ProviderError } from "../errors.ts";
import {
  cuisinesToGoogleIncludedTypes,
  fromGooglePriceLevel,
  googleTypesToCuisines,
  toGooglePriceLevels,
} from "../normalize.ts";

import type {
  FetchRestaurantsParams,
  NormalizedRestaurant,
  RestaurantProvider,
} from "./index.ts";

const NEARBY_SEARCH_URL =
  "https://places.googleapis.com/v1/places:searchNearby";

/**
 * Field mask: only the fields we map into NormalizedRestaurant. Keeping the mask
 * tight is both a privacy and a billing matter on v1 (charged per requested SKU).
 * `photos.name` is requested so a future photo-proxy can use it; Phase 2 leaves
 * `photo_url` null on the normalized output anyway (see NormalizedRestaurant doc).
 */
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.location",
  "places.rating",
  "places.priceLevel",
  "places.types",
  "places.photos.name",
  "places.currentOpeningHours.openNow",
].join(",");

/** Caps: v1 Nearby Search currently returns up to 20 places per request. */
const MAX_RESULT_COUNT = 20;

interface GoogleNearbyResponse {
  places?: GooglePlace[];
}

interface GooglePlace {
  id?: string;
  displayName?: { text?: string };
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  priceLevel?: string;
  types?: string[];
  photos?: { name?: string }[];
  currentOpeningHours?: { openNow?: boolean };
}

export class GooglePlacesProvider implements RestaurantProvider {
  async fetchRestaurants(
    params: FetchRestaurantsParams,
  ): Promise<NormalizedRestaurant[]> {
    const apiKey = Deno.env.get("PROVIDER_GOOGLE_API_KEY");
    if (!apiKey) {
      // Configuration failure — surface as PROVIDER_ERROR. The missing-key detail
      // stays in the server log; the client just sees the safe default message.
      console.error("[provider.google] PROVIDER_GOOGLE_API_KEY is not set");
      throw new ProviderError("missing PROVIDER_GOOGLE_API_KEY");
    }

    const includedTypes = cuisinesToGoogleIncludedTypes(params.cuisines);
    const priceLevels = toGooglePriceLevels(params.priceLevels);

    // v1 Nearby Search request body. `restaurant` is included as a safety net so
    // an unknown/empty cuisine filter still returns the right category.
    const body: Record<string, unknown> = {
      maxResultCount: MAX_RESULT_COUNT,
      includedTypes: includedTypes.length > 0 ? includedTypes : ["restaurant"],
      locationRestriction: {
        circle: {
          center: { latitude: params.lat, longitude: params.lng },
          radius: params.radiusM,
        },
      },
    };
    if (priceLevels) body.priceLevels = priceLevels;

    let json: GoogleNearbyResponse;
    try {
      const res = await fetch(NEARBY_SEARCH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": FIELD_MASK,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "<no body>");
        console.error("[provider.google] non-2xx", {
          status: res.status,
          body: text.slice(0, 500),
        });
        throw new ProviderError(`google places ${res.status}`);
      }
      json = (await res.json()) as GoogleNearbyResponse;
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      console.error("[provider.google] fetch failed", err);
      throw new ProviderError(err);
    }

    const places = json.places ?? [];

    // Post-filter: openNow + excludeProviderRefs. v1's openNow happens via the
    // `currentOpeningHours.openNow` field rather than a server-side filter when
    // we want a forgiving experience (places without opening hours data fall
    // through); a strict filter would drop unknowns. excludeProviderRefs has no
    // native v1 param (Phase 3 widen passes already-seen ids).
    const exclude = new Set(params.excludeProviderRefs ?? []);
    const out: NormalizedRestaurant[] = [];
    for (const p of places) {
      if (
        !p.id ||
        !p.displayName?.text ||
        !p.location?.latitude ||
        !p.location?.longitude
      ) {
        // Drop malformed entries silently — Google occasionally returns sparse
        // rows on edge of coverage; logging each one would be noisy.
        continue;
      }
      if (exclude.has(p.id)) continue;
      const openNow = p.currentOpeningHours?.openNow ?? null;
      if (params.openNow && openNow === false) continue;

      out.push({
        provider: "google",
        provider_ref: p.id,
        name: p.displayName.text,
        lat: p.location.latitude,
        lng: p.location.longitude,
        rating: typeof p.rating === "number" ? p.rating : null,
        price_level: fromGooglePriceLevel(p.priceLevel),
        cuisines: googleTypesToCuisines(p.types),
        // Phase 2: see NormalizedRestaurant doc — photo bytes require the
        // server-only API key, so we ship null and the UI uses a placeholder.
        photo_url: null,
        is_open_now: openNow,
      });
    }
    return out;
  }
}
