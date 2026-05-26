import { createSupabaseClient } from "@munch/api-client";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser Supabase client, created lazily and memoized so the anonymous session
 * persists across reads within a page's lifetime.
 *
 * SECURITY (CLAUDE.md §3): reads ONLY the public `NEXT_PUBLIC_*` config (anon
 * key) — never a service-role or provider key. Evaluated on first use, never at
 * module load, so a missing-env throw can't break static prerender / `next build`.
 */
let client: SupabaseClient | undefined;

export function getSupabaseClient(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      throw new Error(
        "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
          "Copy .env.example to .env.local and set them (see README).",
      );
    }
    client = createSupabaseClient({ url, anonKey });
  }
  return client;
}
