# Phase A — Shared Token Foundation: Agent Prompts

**Project:** Munch
**Source:** `docs/11-ui-roadmap.md` §2 (Phase A) — expands the "UI polish" bullet of
`docs/07-initial-roadmap.md` §6 (Phase 4).
**Purpose:** Phase A broken into sequential, self-contained prompts for a Claude Code agent.

---

## How to use this

Each prompt below is dependency-ordered. Run them in sequence. Within Prompt 2 the mobile and
web halves are independent and may be done in either order, but both must land before Prompt 3.

**Prepend the shared preamble to every prompt.**

Phase A is the **shared token foundation** for the reskin (the "Munch Visual Language",
`docs/09-design-system.md`). The app is **functionally complete through Phase 4.5**; what's
missing is the *look*. This phase delivers **one platform-agnostic source of truth** for the
visual language — the `@munch/ui` package — and proves both apps can consume it. It is
**presentation-only**: no domain logic, endpoint, or realtime wiring changes; no screen is
reskinned yet (that is Phase B mobile / Phase C web). This phase **adds no token to a screen**
beyond the minimal import proof in Prompt 2.

### Phase A maps to two roadmap bullets + one exit criterion

- Create `packages/ui` with `tokens.ts` (colors, typography, spacing, radii, shadows), no RN
  and no DOM imports, mirroring `@munch/core` packaging → Prompt 1
- Wire it into the pnpm workspace + base tsconfig so both apps resolve it → Prompt 2
- Exit: both apps can import `@munch/ui` tokens and typecheck; values match
  `09-design-system.md` exactly → Prompts 2, 3

### Decisions locked (from `11-ui-roadmap.md` §1, do not relitigate)

- Tokens live **once** in **`@munch/ui`** and are **not** duplicated per app.
- The package mirrors `@munch/core` packaging: **source export, no build step**.
- **No `react-native-web`.** Tokens are shared; component *implementations* stay per-app
  (Phase B/C). This phase ships **no components** — values only.
- `@munch/ui` is **platform-agnostic**: **no React Native and no DOM imports**, so both apps
  and (if ever needed) server rendering can consume it.

### What already exists (build on this, don't rebuild)

- `pnpm-workspace.yaml` already globs `packages/*`, so a new `packages/ui` is picked up
  automatically — no workspace-glob edit is needed.
- `tsconfig.base.json` has **no `paths` map**; cross-package resolution is via pnpm workspace
  symlinks + `"<pkg>": "workspace:*"` in each consumer's `package.json` (see how
  `@munch/core` is referenced in `apps/*/package.json`). Follow that exact pattern.
- `apps/mobile/src/theme/index.ts` is the **dark Phase-0 placeholder** and
  `apps/web` has no design system yet. **Do not repoint the mobile theme or seed Tailwind in
  this phase** — that is Phase B / Phase C. Phase A only makes `@munch/ui` importable.

**Exit check (after all 3):** `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build`
are green tree-wide; `@munch/ui` exports the full token set with values matching
`09-design-system.md` §4–§6 exactly; the package contains no React Native or DOM import; both
apps declare `@munch/ui` as a dependency and import a token without type error.

---

## Shared preamble — prepend to every prompt

```
You are working in the Munch monorepo. Before starting:
- Read CLAUDE.md (root) and, for this phase, docs/09-design-system.md (§3 packaging, §4 color,
  §5 typography, §6 spacing/radii/elevation, §9 invariants), docs/11-ui-roadmap.md (§2 Phase A,
  §7 constraints), and docs/05-folder-structure.md (§2 monorepo rules).
- This is Phase A (Shared Token Foundation) of the UI reskin. It is PRESENTATION-ONLY:
  do not change any domain logic, endpoint, RPC, realtime wiring, or screen behavior, and
  do not reskin any screen yet (that is Phase B mobile / Phase C web). No component declares
  a match or calls the provider; matching/ranking/shuffle stay in @munch/core
  (09-design-system.md §9, CLAUDE.md §2/§4).
- Tokens live ONCE in @munch/ui and are never duplicated per app. @munch/ui must contain
  NO React Native and NO DOM imports — platform-agnostic TypeScript constants only.
- 09-design-system.md is canonical for token VALUES. Use the SEMANTIC ROLES in §4 (brand,
  heat, surface, text, …) — NOT the Material-style names in the Stitch designMd. Where a
  doc table and code disagree, that is a bug: reconcile in the same change (CLAUDE.md §1).
- Make the smallest change that satisfies the task. TypeScript strict everywhere; no `any`.
- When done, run the stated acceptance checks and report their actual output.
```

---

## Prompt 1 — Create `@munch/ui` with the token layer

```
Goal: scaffold the @munch/ui package and author tokens.ts — the single, platform-agnostic
source of truth for Munch's visual language (colors, typography, spacing, radii, shadows).
Reference: docs/09-design-system.md §3 (packaging + platform mapping), §4 (color), §5
(typography), §6 (spacing/radii/elevation); docs/05-folder-structure.md §2; mirror the
packaging of packages/core (package.json exports, tsconfig) exactly.

Deliver:
- packages/ui/package.json — name "@munch/ui", private, "type": "module",
  "exports": { ".": "./src/index.ts" }, "types": "./src/index.ts", scripts
  (typecheck: tsc -p tsconfig.json; lint: eslint . --max-warnings 0). NO build step.
  Match @munch/core's package.json shape; @munch/ui has NO runtime dependencies.
- packages/ui/tsconfig.json — extends ../../tsconfig.base.json with module "ESNext",
  moduleResolution "Bundler", include ["src"] (same as packages/core/tsconfig.json).
- packages/ui/src/tokens.ts — typed `as const` constants, NO React Native / NO DOM imports:
  - colors: the SEMANTIC ROLES from 09-design-system.md §4 — brand #ffbf00, brand-pressed
    #fbbc00, on-brand #1c1b1b, heat #fc7c31, heat-strong #9f4200, on-heat #ffffff,
    background #fcf9f8, surface #ffffff, surface-raised #f6f3f2, surface-sunken #f0eded,
    surface-highest #e5e2e1, text #1c1b1b, text-muted #504532, text-faint #827660,
    border #d4c5ab, error #ba1a1a, on-error #ffffff, error-container #ffdad6,
    online #2fbf71. (Do NOT use the Stitch Material names like primary=#795900.)
  - typography: the 8 styles from §5 (display-lg, display-lg-mobile, headline-md, title-lg,
    body-lg, body-md, label-md, caption) as objects with fontSize (px number), fontWeight
    (string, e.g. "700"), lineHeight (unitless multiplier number), and letterSpacing where
    specified (em number). Note the canonical font is Quicksand (loaded per-app in B/C).
  - spacing: xs 4, sm 12, base 8, gutter 16, md 24, lg 48, xl 64 (px numbers); plus the
    layout constants from §6 — screenMarginMobile 20 and desktop contentMaxWidth 1200 /
    margin 48.
  - radii: sm 8, DEFAULT 16, md 24, lg 32, xl 48, full 9999 (px numbers).
  - shadows: shadow-low (yOffset 2, blur 4, color #1c1b1b, opacity 0.10) and shadow-active
    (yOffset 6, blur 12, color #1c1b1b, opacity 0.15) as structured objects (each platform
    renders them differently, so store primitives, not a CSS/RN string); plus the press
    affordance constant (2px downward translate).
  Keep numbers unitless/primitive so each platform adapts them (09-design-system.md §3); add a
  brief comment on any unit decision (e.g. letterSpacing stored in em).
- packages/ui/src/index.ts — barrel re-exporting tokens (+ their inferred types).
- Add @munch/ui to the workspace's lint/typecheck reach if any root config enumerates
  packages explicitly (it likely does not — packages/* is globbed).

Done when: `pnpm --filter @munch/ui typecheck` and `pnpm --filter @munch/ui lint` pass; every
value in tokens.ts matches 09-design-system.md §4–§6 exactly; the package imports nothing from
react-native or any DOM/browser global. Do NOT duplicate these values into apps later.
```

---

## Prompt 2 — Wire `@munch/ui` into both apps (import proof)

```
Goal: make @munch/ui resolvable from both apps and prove the Phase A exit criterion —
"both apps can import @munch/ui tokens and typecheck" — WITHOUT reskinning any screen.
Reference: docs/11-ui-roadmap.md §2 (exit criteria), docs/09-design-system.md §3 (platform
mapping). Depends on Prompt 1. The mobile and web halves are independent.

Deliver:
- apps/mobile/package.json: add "@munch/ui": "workspace:*" to dependencies (alongside the
  existing "@munch/core" / "@munch/api-client" workspace entries). Run pnpm install so the
  symlink is created.
- apps/web/package.json: add "@munch/ui": "workspace:*" likewise. Run pnpm install.
- A MINIMAL import proof in each app that the package resolves and typechecks — do not start
  the reskin:
  - Mobile: import `colors` (or the tokens barrel) into apps/mobile/src/theme/index.ts and
    reference at least one value in a type-checked way (e.g. a `const munchBrand = colors.brand`
    export), WITHOUT yet replacing the dark placeholder palette or its consumers. Leave a
    short comment marking this as the Phase A seam that Phase B will build the real theme on.
  - Web: add a tiny module under apps/web/src (e.g. src/lib/tokens.ts) that re-exports or
    references a @munch/ui token, type-checked, so the dependency is exercised. Do NOT add
    Tailwind or seed a theme here (that is Phase C).
- Do not change any screen's rendered output or behavior; do not touch domain logic,
  endpoints, realtime, or the swipe/match/resolution flows.

Done when: `pnpm install` succeeds with both apps depending on @munch/ui; tree-wide
`pnpm typecheck` and `pnpm build` pass; both apps reference a @munch/ui token without type
error; no screen behavior changed (no provider call, no match declaration, no wiring touched).
```

---

## Prompt 3 — Phase A exit verification + doc reconciliation

```
Goal: verify Phase A's exit criteria and reconcile any doc/code drift introduced, so the
phase closes green and the docs match reality (CLAUDE.md §1).
Reference: docs/11-ui-roadmap.md §2 (exit criteria) + §5 (Phase D verify checklist as the
standard), docs/09-design-system.md §4–§6 (the canonical values), §9 (invariants). Depends on
Prompts 1–2.

Deliver:
- Run the full gate and report actual output: `pnpm typecheck`, `pnpm lint`, `pnpm test`,
  `pnpm build` (whole tree).
- Audit @munch/ui for platform leakage: confirm there is NO import of react-native, no DOM /
  browser global, and no runtime dependency in packages/ui/package.json. Report the grep/
  inspection result.
- Token-parity check: confirm every color/typography/spacing/radius/shadow value in
  tokens.ts matches 09-design-system.md §4–§6 exactly (semantic role names, not the Stitch
  Material names). Fix any mismatch in whichever side is wrong, in this change.
- Invariant check (presentation-only): confirm Phase A changed no domain logic, endpoint,
  realtime wiring, or screen behavior — no component declares a match or calls the provider
  (09-design-system.md §9). The only app-side edits are the Prompt 2 import seams.
- Doc reconciliation: update docs/11-ui-roadmap.md so Phase A reads as delivered (its exit
  criteria met) and any doc that described @munch/ui as not-yet-existing (e.g.
  09-design-system.md §3's package tree, if it implied a future state) now matches the shipped
  package. Keep edits minimal and factual.

Done when: all four gate commands are green tree-wide; @munch/ui has zero platform/runtime
imports; token values match 09-design-system.md exactly; no UI invariant was weakened; and the
docs describe the package as it now exists. Report the command output and the exact files
changed.
```
