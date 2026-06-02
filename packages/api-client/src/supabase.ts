import {
  type AuthFlowType,
  createClient,
  type SupabaseClient,
  type SupportedStorage,
} from "@supabase/supabase-js";

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
 * Platform-agnostic auth options the factory threads into supabase-js. The factory
 * intentionally hardcodes NO platform storage (CLAUDE.md §4): mobile passes an AsyncStorage
 * adapter + `flowType: 'pkce'` (so accounts survive a relaunch and OAuth PKCE has somewhere to
 * stash its verifier across the browser round-trip); web omits both and keeps supabase-js
 * defaults (in-memory storage, `detectSessionInUrl: true`).
 */
export interface SupabaseAuthOptions {
  storage?: SupportedStorage;
  flowType?: AuthFlowType;
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
  auth?: SupabaseAuthOptions,
): SupabaseClient {
  const url = config?.url ?? process.env.SUPABASE_URL;
  const anonKey = config?.anonKey ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "createSupabaseClient: missing Supabase URL or anon key. Pass { url, anonKey } " +
        "or set SUPABASE_URL / SUPABASE_ANON_KEY.",
    );
  }
  // Only forward auth options the caller actually set, so web keeps supabase-js defaults
  // (in-memory storage, detectSessionInUrl: true) and mobile can opt into AsyncStorage + PKCE.
  const authOptions: SupabaseAuthOptions = {};
  if (auth?.storage !== undefined) authOptions.storage = auth.storage;
  if (auth?.flowType !== undefined) authOptions.flowType = auth.flowType;
  // `createClient`'s inferred generic defaults differ from the bare `SupabaseClient`
  // alias used across this package; normalize here so the whole api-client (and its
  // consumers) speak one client type.
  return createClient(url, anonKey, { auth: authOptions }) as SupabaseClient;
}
