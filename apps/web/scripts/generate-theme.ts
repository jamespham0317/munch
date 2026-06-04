/**
 * Seed the web Tailwind v4 theme from the shared `@munch/ui` tokens.
 *
 * Tokens live ONCE in `@munch/ui` (09-design-system.md §3); they must never be
 * hand-copied into the app. This script imports them and emits
 * `app/theme.generated.css` — a Tailwind v4 `@theme` block plus a `:root` block
 * of layout constants — re-hyphenating the camelCase token keys into the kebab
 * CSS custom properties Tailwind expects (`brandPressed` → `--color-brand-pressed`,
 * `displayLgMobile` → `--text-display-lg-mobile`, …).
 *
 * It runs before `dev`/`build` (so the theme is always current) and supports a
 * `--check` mode that fails if the committed file has drifted from the tokens —
 * the single-source-of-truth guard wired into the test gate.
 *
 * Run: `pnpm generate-theme` (write) or `pnpm generate-theme:check` (verify).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  colors,
  pressTranslateY,
  radii,
  shadows,
  spacing,
  typography,
} from "@munch/ui";

/** camelCase token key → kebab CSS-var suffix. `DEFAULT` is kept verbatim so it
 *  maps to Tailwind's bare utility (e.g. `--radius-DEFAULT` → `rounded`). */
function toKebab(key: string): string {
  if (key === "DEFAULT") return "DEFAULT";
  return key.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

/** `#1c1b1b` → `28 27 27` (space-separated channels for `rgb(... / <alpha>)`). */
function hexToRgbChannels(hex: string): string {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

const themeLines: string[] = [];

// Color roles → `--color-*` (09-design-system.md §4).
for (const [name, value] of Object.entries(colors)) {
  themeLines.push(`  --color-${toKebab(name)}: ${value};`);
}

// Type scale → `--text-*` with paired line-height / weight / tracking modifiers
// (09-design-system.md §5). Line-height is a unitless multiplier; tracking is em.
for (const [name, style] of Object.entries(typography)) {
  const n = toKebab(name);
  themeLines.push(`  --text-${n}: ${style.fontSize}px;`);
  themeLines.push(`  --text-${n}--line-height: ${style.lineHeight};`);
  themeLines.push(`  --text-${n}--font-weight: ${style.fontWeight};`);
  if ("letterSpacing" in style) {
    themeLines.push(`  --text-${n}--letter-spacing: ${style.letterSpacing}em;`);
  }
}

// Corner radii → `--radius-*` (09-design-system.md §6).
for (const [name, value] of Object.entries(radii)) {
  themeLines.push(`  --radius-${toKebab(name)}: ${value}px;`);
}

// Named spacing scale → `--spacing-*` (the numeric `--spacing` base multiplier is
// left at Tailwind's default so `p-4` etc. still work). Layout constants
// (max-width, margins) are emitted to `:root` below, not as spacing utilities.
const spacingScale = ["xs", "sm", "base", "gutter", "md", "lg", "xl"] as const;
for (const key of spacingScale) {
  themeLines.push(`  --spacing-${toKebab(key)}: ${spacing[key]}px;`);
}

// Ambient soft shadows → `--shadow-*` (09-design-system.md §6). The keys are
// `shadowLow`/`shadowActive`; strip the leading `shadow-` so the utility is
// `shadow-low` / `shadow-active`.
for (const [name, s] of Object.entries(shadows)) {
  const suffix = toKebab(name).replace(/^shadow-/, "");
  themeLines.push(
    `  --shadow-${suffix}: 0 ${s.yOffset}px ${s.blur}px rgb(${hexToRgbChannels(s.color)} / ${s.opacity});`,
  );
}

// Layout constants (09-design-system.md §6) — consumed by the `.munch-container`
// helper and the press affordance; not Tailwind utility namespaces.
const rootLines = [
  `  --munch-content-max-width: ${spacing.contentMaxWidth}px;`,
  `  --munch-desktop-margin: ${spacing.desktopMargin}px;`,
  `  --munch-screen-margin-mobile: ${spacing.screenMarginMobile}px;`,
  `  --munch-press-translate-y: ${pressTranslateY}px;`,
];

const header = `/*
 * AUTO-GENERATED from @munch/ui by apps/web/scripts/generate-theme.ts.
 * Do NOT edit by hand — run \`pnpm generate-theme\`. Tokens live once in
 * @munch/ui (09-design-system.md §3); this file re-hyphenates them into the
 * Tailwind v4 theme so the web palette is never duplicated in the app.
 */`;

const css = `${header}\n\n@theme {\n${themeLines.join("\n")}\n}\n\n:root {\n${rootLines.join("\n")}\n}\n`;

const outPath = join(import.meta.dirname, "..", "app", "theme.generated.css");
const isCheck = process.argv.includes("--check");

if (isCheck) {
  let current = "";
  try {
    current = readFileSync(outPath, "utf8");
  } catch {
    console.error(
      "theme.generated.css is missing — run `pnpm generate-theme`.",
    );
    process.exit(1);
  }
  if (current !== css) {
    console.error(
      "theme.generated.css is out of sync with @munch/ui — run `pnpm generate-theme`.",
    );
    process.exit(1);
  }
  console.log("theme.generated.css is in sync with @munch/ui.");
} else {
  writeFileSync(outPath, css);
  console.log(`Wrote ${outPath} from @munch/ui tokens.`);
}
