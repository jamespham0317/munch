/**
 * Tailwind v4 is a PostCSS plugin (`@tailwindcss/postcss`). Next 16 + Turbopack
 * picks this config up automatically. The theme itself is seeded from @munch/ui
 * via scripts/generate-theme.ts (09-design-system.md §3), not configured here.
 */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
