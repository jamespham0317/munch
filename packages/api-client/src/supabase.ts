import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client factory — the data layer's entry point.
 *
 * SECURITY (CLAUDE.md §3; docs/06 §9, §12): this factory reads ONLY the public
 * Supabase URL and anon key. The service-role key and any provider API key are
 * server-only and must NEVER be read here or shipped in an app bundle. The
 * function signature accepts nothing else, by design.
 */

/** Public, client-safe Supabase config. Anon key only — never a service-role key. */
export interface SupabaseClientConfig {
  url: string;
  anonKey: string;
}

/**
 * Create a Supabase client from explicit public config, falling back to the
 * un-prefixed `SUPABASE_URL` / `SUPABASE_ANON_KEY` env vars (used in Node/tests).
 *
 * Apps pass their platform env explicitly (`NEXT_PUBLIC_*` / `EXPO_PUBLIC_*`),
 * because those prefixes are inlined per-bundler and a shared package can't read
 * them. Throws on missing config — a startup misconfiguration, not a runtime API
 * error to surface to users.
 */
export function createSupabaseClient(
  config?: Partial<SupabaseClientConfig>,
): SupabaseClient {
  const url = config?.url ?? process.env.SUPABASE_URL;
  const anonKey = config?.anonKey ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "createSupabaseClient: missing Supabase URL or anon key. Pass { url, anonKey } " +
        "or set SUPABASE_URL / SUPABASE_ANON_KEY.",
    );
  }
  // `createClient`'s inferred generic defaults differ from the bare `SupabaseClient`
  // alias used across this package; normalize here so the whole api-client (and its
  // consumers) speak one client type.
  return createClient(url, anonKey) as SupabaseClient;
}
