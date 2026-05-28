// _shared/provider/fake.ts
// FakeProvider — a deterministic RestaurantProvider for Prompt-7 integration tests.
// It NEVER hits the network: it returns a fixed NormalizedRestaurant[] loaded from
// fake-restaurants.json. Wired in only when PROVIDER=fake (see getProvider in
// index.ts), an env flag that production deployment env must never set — so the real
// GooglePlacesProvider is always used outside local tests.
//
// WHY this exists: tests must not call the real provider (CLAUDE.md §7), and the
// per-session-call invariant (§2.1) is verified by asserting EXACTLY ONE fetch per
// session start. Fetches are counted at the abstraction boundary (getProvider in
// index.ts), so this provider needs no counter of its own — the §2.1 verifier reads
// the same count whether the real or fake provider is configured.

import { ProviderError } from "../errors.ts";

import fixture from "./fake-restaurants.json" with { type: "json" };

import type {
  FetchRestaurantsParams,
  NormalizedRestaurant,
  RestaurantProvider,
} from "./index.ts";

/** The canned deck. Frozen so a test can't mutate the shared module-level fixture. */
const FAKE_DECK: readonly NormalizedRestaurant[] = Object.freeze(
  (fixture as NormalizedRestaurant[]).map((r) => Object.freeze({ ...r })),
);

/**
 * Deterministic test provider. Returns the JSON fixture verbatim (after honoring
 * `excludeProviderRefs`, so a future widen-round test sees the same skip behavior as
 * the real provider). Set PROVIDER_FAKE_THROW=1 in the served env to exercise the
 * Edge Function's PROVIDER_ERROR path.
 */
export class FakeProvider implements RestaurantProvider {
  fetchRestaurants(
    params: FetchRestaurantsParams,
  ): Promise<NormalizedRestaurant[]> {
    if (Deno.env.get("PROVIDER_FAKE_THROW")) {
      // Mirrors a provider outage — the Edge Function maps this to PROVIDER_ERROR
      // and never surfaces the raw cause (CLAUDE.md §3).
      throw new ProviderError("fake provider configured to throw");
    }
    const exclude = new Set(params.excludeProviderRefs ?? []);
    const out = FAKE_DECK.filter((r) => !exclude.has(r.provider_ref)).map(
      (r) => ({ ...r }),
    );
    return Promise.resolve(out);
  }
}
