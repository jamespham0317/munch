"use client";

import { useSmokeRestaurant } from "./use-smoke-restaurant";

/**
 * Renders the Phase 0 smoke read: an anonymous session reading the seeded
 * restaurant under RLS. Presentational only — orchestration lives in the hook
 * and data access in @munch/api-client (CLAUDE.md §4).
 */
export function SmokeTest() {
  const query = useSmokeRestaurant();

  if (query.isPending) {
    return <p>Connecting to Supabase…</p>;
  }
  if (query.isError) {
    // Message is the api-client's safe envelope text — never a raw DB error.
    return (
      <p role="alert">Couldn’t load the seeded row: {query.error.message}</p>
    );
  }

  const restaurant = query.data;
  return (
    <section>
      <p>Read under RLS via an anonymous session:</p>
      <p>
        <strong>{restaurant.name}</strong> — rating {restaurant.rating ?? "n/a"}
      </p>
    </section>
  );
}
