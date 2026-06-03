import path from "node:path";

import type { NextConfig } from "next";

/**
 * @munch/core, @munch/api-client, and @munch/ui are published as raw TypeScript
 * source (their package `exports` point at `./src/index.ts`, with no build step),
 * so Next must transpile them rather than expecting prebuilt JS. @munch/ui is here
 * because its token `colors` are imported at runtime in a client component (the
 * match confetti palette); the Tailwind theme seeds from it at build time too.
 * See CLAUDE.md §4 and ui-roadmap.md §4 (Phase C, Prompt 1).
 */
const nextConfig: NextConfig = {
  // Pin the workspace root so Turbopack uses the monorepo (two levels up) rather
  // than inferring it from an unrelated lockfile elsewhere on the machine.
  turbopack: {
    root: path.join(import.meta.dirname, "..", ".."),
  },
  transpilePackages: ["@munch/core", "@munch/api-client", "@munch/ui"],
};

export default nextConfig;
