// Polyfill the WHATWG URL API for @supabase/supabase-js — React Native has no
// global URL. Must load before any Supabase client is constructed.
import "react-native-url-polyfill/auto";

import { createSupabaseClient } from "@munch/api-client";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
 * Session storage (Phase 4.5): an AsyncStorage adapter + the PKCE flow are threaded
 * into the shared api-client factory (its `storage`/`flowType` options — never a
 * second client). Two reasons: a real account should survive an app relaunch, and
 * Google OAuth's PKCE verifier must persist across the browser round-trip. The
 * platform storage lives here, not in the factory, so the factory stays
 * platform-agnostic (CLAUDE.md §4). Guests remain ephemeral by nature — an anonymous
 * session never writes a `profiles` row, so persisting it changes nothing about the
 * guest/account boundary (CLAUDE.md §3).
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
  client = createSupabaseClient(
    { url, anonKey },
    { storage: AsyncStorage, flowType: "pkce" },
  );
  return client;
}
