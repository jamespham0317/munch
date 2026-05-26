import { fetchSmokeRestaurant, signInAnonymously } from "@munch/api-client";
import type { Restaurant } from "@munch/core";
import { useQuery } from "@tanstack/react-query";

import { getSupabaseClient } from "../../lib/supabase";

/**
 * Phase 0 connectivity smoke read.
 *
 * Signs in anonymously, then fetches the seeded `restaurants` row under RLS — both
 * through @munch/api-client, so no data-layer logic lives in the app (CLAUDE.md §4).
 * Proves the Phase 0 exit criterion on device: anonymous session + seeded read
 * under RLS.
 *
 * api-client returns the safe `{ data, error }` shape; we surface `error.message`
 * (already a safe, user-facing string — never a raw DB error) by throwing, which is
 * how TanStack Query reports failures.
 *
 * TODO(Phase 1): replace with real room/session reads once those endpoints land.
 */
export function useSmokeRead() {
  return useQuery<Restaurant, Error>({
    queryKey: ["smoke-restaurant"],
    queryFn: async () => {
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
    },
  });
}
