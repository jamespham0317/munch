"use client";

import { ensureProfile } from "@munch/api-client";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getSupabaseClient } from "@/lib/supabase";

import { currentUserKey } from "./use-current-user";

/**
 * OAuth/redirect landing (docs/04 §2), OUTSIDE any room. On web (implicit flow,
 * detectSessionInUrl) supabase-js establishes the session from the callback URL itself, so this
 * view only waits for that session, writes the profiles row on first sign-in (ensureProfile —
 * CLAUDE.md §3), and routes home. There is no guest upgrade here: the session is a fresh/existing
 * real account. Errors surface as the safe ApiError message; raw auth text is never shown.
 */
export function AuthCallbackView() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const client = getSupabaseClient();
    let active = true;

    async function complete(): Promise<void> {
      const profile = await ensureProfile(client);
      if (!active) {
        return;
      }
      if (profile.error) {
        setError(profile.error.error.message);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: currentUserKey });
      router.replace("/");
    }

    // The session may already be detected by the time we mount; otherwise wait for the
    // SIGNED_IN event that detectSessionInUrl fires once it parses the callback URL.
    void client.auth.getSession().then(({ data }) => {
      if (active && data.session) {
        void complete();
      }
    });
    const { data: sub } = client.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        void complete();
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [router, queryClient]);

  if (error) {
    return (
      <section>
        <p role="alert">{error}</p>
        <Link href="/">Back home</Link>
      </section>
    );
  }
  return <p>Finishing sign-in…</p>;
}
