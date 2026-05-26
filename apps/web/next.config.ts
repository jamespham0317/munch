import path from "node:path";

import type { NextConfig } from "next";

/**
 * @munch/core and @munch/api-client are published as raw TypeScript source
 * (their package `exports` point at `./src/index.ts`, with no build step), so
 * Next must transpile them rather than expecting prebuilt JS. See CLAUDE.md §4.
 */
const nextConfig: NextConfig = {
  // Pin the workspace root so Turbopack uses the monorepo (two levels up) rather
  // than inferring it from an unrelated lockfile elsewhere on the machine.
  turbopack: {
    root: path.join(import.meta.dirname, "..", ".."),
  },
  transpilePackages: ["@munch/core", "@munch/api-client"],
};

export default nextConfig;
