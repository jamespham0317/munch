// _shared/normalize.ts
// Pure helpers used by provider implementations to translate provider-native shapes
// into the app's NormalizedRestaurant. No I/O, no env reads, no Deno globals — pure
// functions so a provider implementation stays a thin HTTP+map adapter.

import type { NormalizedRestaurant } from "./provider/index.ts";

/**
 * Map Google Places v1 `priceLevel` enum (PRICE_LEVEL_*) to the app's `'1'..'4'`
 * (0001 price_level enum). Unknown / FREE / UNSPECIFIED collapse to null — the
 * column is nullable, the UI shows blank.
 */
export function fromGooglePriceLevel(
  level: string | null | undefined,
): NormalizedRestaurant["price_level"] {
  switch (level) {
    case "PRICE_LEVEL_INEXPENSIVE":
      return "1";
    case "PRICE_LEVEL_MODERATE":
      return "2";
    case "PRICE_LEVEL_EXPENSIVE":
      return "3";
    case "PRICE_LEVEL_VERY_EXPENSIVE":
      return "4";
    default:
      return null;
  }
}

/**
 * Reverse map: the app's `'1'..'4'` filter set → Google v1 `priceLevels` request
 * field. Returns the array Google's API expects (or undefined for no filter).
 */
export function toGooglePriceLevels(
  levels: ("1" | "2" | "3" | "4")[] | null | undefined,
): string[] | undefined {
  if (!levels || levels.length === 0) return undefined;
  const mapped: string[] = [];
  for (const l of levels) {
    switch (l) {
      case "1":
        mapped.push("PRICE_LEVEL_INEXPENSIVE");
        break;
      case "2":
        mapped.push("PRICE_LEVEL_MODERATE");
        break;
      case "3":
        mapped.push("PRICE_LEVEL_EXPENSIVE");
        break;
      case "4":
        mapped.push("PRICE_LEVEL_VERY_EXPENSIVE");
        break;
    }
  }
  return mapped.length > 0 ? mapped : undefined;
}

/**
 * Map the app's free-form cuisine identifiers to Google v1 `includedTypes`. The
 * known set covers the common cases; unknown values are dropped (an unknown cuisine
 * with no Google type is a noop filter, NOT a fallback to all restaurants — the
 * caller still passes `restaurant` as a safety net). Keep small and deterministic;
 * a proper taxonomy is post-v1 (the per-member "narrow" filters are deferred too —
 * CLAUDE.md §8 deferred list).
 */
const CUISINE_TO_GOOGLE_TYPE: Readonly<Record<string, string>> = {
  italian: "italian_restaurant",
  japanese: "japanese_restaurant",
  chinese: "chinese_restaurant",
  mexican: "mexican_restaurant",
  thai: "thai_restaurant",
  indian: "indian_restaurant",
  french: "french_restaurant",
  korean: "korean_restaurant",
  vietnamese: "vietnamese_restaurant",
  greek: "greek_restaurant",
  mediterranean: "mediterranean_restaurant",
  american: "american_restaurant",
  pizza: "pizza_restaurant",
  sushi: "sushi_restaurant",
  steak: "steak_house",
  seafood: "seafood_restaurant",
  vegetarian: "vegetarian_restaurant",
  vegan: "vegan_restaurant",
  ramen: "ramen_restaurant",
  brunch: "brunch_restaurant",
  bbq: "barbecue_restaurant",
  burger: "hamburger_restaurant",
  cafe: "cafe",
  bakery: "bakery",
};

export function cuisinesToGoogleIncludedTypes(cuisines: string[]): string[] {
  const out = new Set<string>();
  for (const c of cuisines) {
    const t = CUISINE_TO_GOOGLE_TYPE[c.toLowerCase()];
    if (t) out.add(t);
  }
  return Array.from(out);
}

/**
 * Reverse map: Google v1 `types` (per-place) → app cuisine identifiers. Only
 * recognized restaurant types translate back; the rest are dropped (we don't
 * persist arbitrary Google taxonomy in `restaurants.cuisines`).
 */
const GOOGLE_TYPE_TO_CUISINE: Readonly<Record<string, string>> =
  Object.fromEntries(
    Object.entries(CUISINE_TO_GOOGLE_TYPE).map(([k, v]) => [v, k]),
  );

export function googleTypesToCuisines(
  types: string[] | null | undefined,
): string[] {
  if (!types) return [];
  const out = new Set<string>();
  for (const t of types) {
    const c = GOOGLE_TYPE_TO_CUISINE[t];
    if (c) out.add(c);
  }
  return Array.from(out);
}
