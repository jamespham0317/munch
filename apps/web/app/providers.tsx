"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

/**
 * Client-side provider tree. The root layout is a Server Component, so the
 * TanStack Query client (server state layered over @munch/api-client, per
 * docs/08 §4) lives here. `useState` keeps one client instance per browser
 * session rather than recreating it on every render.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
