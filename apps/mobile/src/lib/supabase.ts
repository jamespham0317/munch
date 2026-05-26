// Polyfill the WHATWG URL API for @supabase/supabase-js — React Native has no
// global URL. Must load before any Supabase client is constructed.
import "react-native-url-polyfill/auto";

import { createSupabaseClient } from "@munch/api-client";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The app's single Supabase client, built from Expo's public env. This is platform
 * glue (docs/05 §3 `lib/`), not business logic: it only injects the EXPO_PUBLIC_*
 * config into the api-client factory, which remains the sole owner of client
 * construction (CLAUDE.md §4 — no duplicated data-layer logic in the app).
 *
 * SECURITY (CLAUDE.md §3): only the public URL + anon key are read here. The
 * service-role key and any provider key are server-only and must never reach the
 * app bundle.
 *
 * Phase 0: no AsyncStorage — an in-memory anonymous session per launch is all the
 * connectivity smoke test needs. Session persistence (and the storage adapter it
 * requires) is a Phase 1 concern, handled by extending the api-client factory, not
 * by constructing a second client here.
 */
let client: SupabaseClient | undefined;

export function getSupabaseClient(): SupabaseClient {
  if (client) {
    return client;
  }
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    // A startup misconfiguration, not a runtime API error to surface to users.
    throw new Error(
      "Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy " +
        "apps/mobile/.env.example to apps/mobile/.env and fill in your local Supabase values.",
    );
  }
  client = createSupabaseClient({ url, anonKey });
  return client;
}
