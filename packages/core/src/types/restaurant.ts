import type { PriceLevel } from "./enums";

/**
 * The app's normalized restaurant model, populated once per session from the
 * provider. Mirrors `restaurants` (docs/03-database-schema.md §3.5). Session-scoped
 * and short-lived (`expiresAt`) to respect provider caching terms.
 */
export interface Restaurant {
  id: string;
  /** Provider identifier, e.g. `"google"`. */
  provider: string;
  /** The provider's own place id. */
  providerRef: string;
  name: string;
  lat: number;
  lng: number;
  rating: number | null;
  priceLevel: PriceLevel | null;
  cuisines: string[];
  photoUrl: string | null;
  isOpenNow: boolean | null;
  fetchedAt: string;
  expiresAt: string;
}
