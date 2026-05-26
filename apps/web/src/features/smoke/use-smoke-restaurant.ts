import { fetchSmokeRestaurant, signInAnonymously } from "@munch/api-client";
import type { Restaurant } from "@munch/core";
import { useQuery } from "@tanstack/react-query";

import { getSupabaseClient } from "@/lib/supabase";

/**
 * Phase 0 connectivity check (the web exit criterion): sign in anonymously, then
 * read the seeded restaurant under RLS. All data access goes through
 * @munch/api-client — no endpoint shapes or row mapping live in the app (CLAUDE.md §4).
 *
 * The api-client returns the safe `{ error: { code, message } }` envelope; we
 * surface its message as a thrown `Error` so TanStack Query exposes it via
 * `error`. The raw provider/DB error never reaches here (mapped in api-client).
 */
async function loadSmokeRestaurant(): Promise<Restaurant> {
  const client = getSupabaseClient();

  const auth = await signInAnonymously(client);
  if (auth.error) {
    throw new Error(auth.error.error.message);
  }

  const result = await fetchSmokeRestaurant(client);
  if (result.error) {
    throw new Error(result.error.error.message);
  }
  return result.data;
}

export function useSmokeRestaurant() {
  return useQuery<Restaurant, Error>({
    queryKey: ["smoke-restaurant"],
    queryFn: loadSmokeRestaurant,
    retry: false,
  });
}
