import path from "node:path";

import type { NextConfig } from "next";

/**
 * @munch/core, @munch/api-client, and @munch/ui are published as raw TypeScript
 * source (their package `exports` point at `./src/index.ts`, with no build step),
 * so Next must transpile them rather than expecting prebuilt JS. @munch/ui is here
 * because its token `colors` are imported at runtime in a client component (the
 * match confetti palette); the Tailwind theme seeds from it at build time too.
 * See CLAUDE.md §4 and 11-ui-roadmap.md §4 (Phase C, Prompt 1).
 */
const nextConfig: NextConfig = {
  // Pin the workspace root so Turbopack uses the monorepo (two levels up) rather
  // than inferring it from an unrelated lockfile elsewhere on the machine.
  turbopack: {
    root: path.join(import.meta.dirname, "..", ".."),
  },
  // Supabase site_url / additional_redirect_urls are all 127.0.0.1:3000 (supabase/config.toml),
  // so every auth redirect (password-reset, OAuth callback) lands the browser on 127.0.0.1.
  // Next 16's dev server otherwise only serves its HMR / dev-client runtime to its canonical
  // `localhost` origin, so a page opened on 127.0.0.1 fails the HMR websocket handshake and never
  // hydrates — the recovery effect never runs, so /auth/reset stays stuck on the request step.
  // Allowing 127.0.0.1 as a dev origin lets those redirect targets hydrate. Dev-only knob.
  allowedDevOrigins: ["127.0.0.1"],
  transpilePackages: ["@munch/core", "@munch/api-client", "@munch/ui"],
};

export default nextConfig;
