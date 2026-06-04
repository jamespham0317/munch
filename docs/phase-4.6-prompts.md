# Phase 4.6 — Map-based anchor & radius selection: Agent Prompts

**Project:** Munch
**Source:** `docs/07-initial-roadmap.md` §6.6 (Phase 4.6)
**Purpose:** Phase 4.6 broken into sequential, self-contained prompts for a Claude Code agent.

---

## How to use this

Each prompt below is dependency-ordered. Run them in sequence. Prompts 3 (web) and 4 (mobile)
can run in parallel once Prompts 1–2 are done.

**Prepend the shared preamble to every prompt.**

Phase 4.6 **replaces manual latitude/longitude entry** on the Create Room flow (roadmap §6.6)
with an interactive **MapLibre** map + device geolocation. A **fixed center pin** sets the search
anchor (anchor = current map center); a translucent **amber** radius circle is centered on the
pin and bound **bidirectionally** to the existing `RadiusSlider`. It is almost entirely a
**client + presentation** change: there is **no new table, no new migration, no new RPC/Edge
Function, and no change to the `create_room` contract**. The map merely populates the existing
`anchor_lat` / `anchor_lng` / `default_radius_m` / `anchor_label` fields, which `@munch/core`
already validates.

### Resolved decisions driving this phase (do not relitigate)

- **Placement: Create Room only.** The map replaces the manual Latitude/Longitude inputs on the
  Create Room form, where the anchor is already set. The **lobby does not get an editable map** —
  it shows the anchor/radius read-only and keeps the host's existing lobby radius edit.
- **Map stack: MapLibre + OpenStreetMap raster tiles.** MapLibre GL JS on web
  (`maplibre-gl`), MapLibre React Native on mobile (`@maplibre/maplibre-react-native`), with free
  OSM raster tiles (`https://tile.openstreetmap.org/{z}/{x}/{y}.png`). **No paid key**; the
  required "© OpenStreetMap contributors" attribution must be visible on the map.
- **Fixed center pin.** A pin fixed to the map's visual center; the host drags the map underneath
  it. Anchor = `map.getCenter()` read on move-end. No tap-to-drop marker.
- **Map-pick only — no geocoding/search.** No forward or reverse geocoding (no extra API). The
  optional free-text `anchor_label` input stays exactly as today.
- **Geolocation is opt-in and never blocks.** Request the device location once on open (web
  `navigator.geolocation`, mobile `expo-location`); center on it when granted, fall back to a
  neutral default center with manual pan when denied/unavailable. Room creation must never be
  blocked by a denied permission.

### What's already in place (build on this, don't rebuild)

- **Anchor + radius are set on Create Room today.** `apps/web/src/features/room/create-room-form.tsx`
  and `apps/mobile/src/features/room/create-room-form.tsx` collect `host_display_name`,
  `anchor_label` (a decorative text field today), **manual `anchor_lat` / `anchor_lng` text
  inputs**, the filters, and `default_radius_m` via `RadiusSlider`, then call the create flow.
  Both forms carry a comment that says "geocoding/map is deferred … so the host enters lat/lng" —
  Phase 4.6 removes that and the lat/lng inputs.
- **`RadiusSlider` exists per platform.** `apps/web/src/components/radius-slider.tsx` and
  `apps/mobile/src/components/ui/radius-slider.tsx` — amber thumb + amber value pill, bounded to
  `RADIUS_MIN_M`…`maxM`. Reuse it; the map subscribes to the same `radiusM` state.
- **The contract is frozen.** `createRoomRequestSchema` (`packages/core/src/validation/rooms.ts`)
  is `{ host_display_name, anchor_label, anchor_lat: latSchema, anchor_lng: lngSchema, filters,
  default_radius_m }`. The map only changes **how** `anchor_lat`/`anchor_lng` are produced. Do
  **not** change the schema, the `create_room` RPC, or any migration.
- **Radius bounds live in `@munch/core`.** `RADIUS_MIN_M = 500`, `RADIUS_MAX_M = 20_000`,
  `DEFAULT_RADIUS_M = 3_000` (`packages/core/src/constants.ts`). The circle math clamps to these.
- **Tokens live in `@munch/ui`.** The amber circle/pin use `brand` (fill) + `heat` (stroke) via
  the web Tailwind theme and the mobile `theme` re-export. Never hardcode hex.
- **The lobby already shows filters.** `apps/web/src/features/room/lobby-filters-panel.tsx`
  (+ mobile twin) renders `FiltersSummary` read-only for non-hosts and an editable radius for the
  host. Phase 4.6 surfaces the anchor there read-only; it does **not** add a map to the lobby.

### No new migration / no new endpoints / no new contract (decide once, here)

- **No SQL migration, no RPC/Edge Function change, no `create_room` contract change.** If you
  think you need any of these, STOP and flag it — you almost certainly do not. This phase is:
  `@munch/core` (pure geo math + tests), the two apps (map components + form wiring), new
  client/native map dependencies, and docs.
- **The OSM tile source is NOT the restaurant provider.** Map tiles are a separate, keyless
  source; fetching them is not a provider call and must not be confused with one. The single
  restaurant-provider fetch still happens only at `start_session` (one per widen).

### Pinned Phase 4.6 decisions (so the agent doesn't relitigate them)

- **Circle as a GeoJSON polygon.** MapLibre's circle layer sizes in *pixels*, not meters, so
  render the radius ring as a `fill` layer from a `@munch/core` helper that builds a closed
  GeoJSON polygon of radius `radiusM` around the center — identical on web and mobile. Regenerate
  it when the center moves or `radiusM` changes.
- **Keep the circle visible.** Use a `@munch/core` `zoomForRadius` helper for the initial zoom and
  when the radius changes, so the ring fits the viewport instead of overflowing or vanishing.
- **`anchor_label` stays optional free text.** No geocoding fills it. The submit still validates
  the whole request with `createRoomRequestSchema`.
- **Per-platform components, shared math.** The map component is built once per app (no
  `react-native-web`, 09-design-system §3); the only shared code is the pure geo math in
  `@munch/core` and the OSM style/attribution constant.
- **New dependencies are approved for this phase only:** `maplibre-gl` (web),
  `@maplibre/maplibre-react-native` + `expo-location` (mobile). MapLibre RN needs native code → a
  config plugin + a dev build (not Expo Go). No other new deps.
- **Deferred stays deferred (roadmap §8):** the restaurant-card **map preview** is still post-v1.
  This phase is only the **anchor-selection** map on Create Room.

### Phase 4.6 maps to the roadmap §6.6 bullets + the exit criterion

- Map + OSM tiles replacing lat/lng on Create Room → Prompt 1 (deps/native config + OSM style),
  Prompt 3 (web component + wiring), Prompt 4 (mobile component + wiring)
- Geolocation centering with safe fallback → Prompts 3/4 (`navigator.geolocation` / `expo-location`)
- Amber radius circle bound to the slider → Prompt 2 (geo math) + Prompts 3/4 (rendering/binding)
- Map-pick only, optional label, host-controlled, no provider call → Prompts 3/4
- Lobby read-only anchor/radius (no editable map) → Prompt 5
- Tests + doc/comment reconciliation + exit verification → Prompts 2 (math tests) and 6

**Exit check (after all 6):** on **both** apps a host opens Create Room, the map centers on their
device location when permission is granted (a sensible default otherwise), the host sets the
anchor by dragging the map under the fixed center pin, an **amber circle tracks the radius slider
from 500 m to 20 km** and stays visible, room creation **succeeds via the unchanged `create_room`
contract**, **no restaurant-provider call** fires on any map/slider interaction, the Places key
appears nowhere in `apps/*`, and the lobby shows the anchor/radius read-only. CI is green and no
"host enters lat/lng" / "map deferred" text remains.

---

## Shared preamble — prepend to every prompt

```
You are working in the Munch monorepo. Before starting:
- Read CLAUDE.md (root) and the docs/ files it points to that are relevant to this task —
  especially docs/07-initial-roadmap.md §6.6 (Phase 4.6), docs/03-database-schema.md and
  docs/04-api-specification.md for the create_room contract (which DOES NOT CHANGE), and
  docs/09-design-system.md + docs/10-pages.md §3.3 for the Create Room screen.
- Honor the §2 invariants and §3 security rules at all times. The two that bind this phase:
  (§2.1) NO provider call on any map pan/zoom/geolocation or radius-slider change — the single
  restaurant-provider fetch stays at start_session; OSM map tiles are a SEPARATE keyless source
  and are not a provider call. (§2.2) anchor + radius are HOST-CONTROLLED for the whole room.
  The server-only Places/service-role keys must never appear in apps/* or packages/*.
- This is Phase 4.6 (Map-based anchor & radius) per docs/07 §6.6. Phases 1–4.5 are DONE — do NOT
  rebuild rooms, the match mechanic, resolution, filters, auth, or match_history. Do NOT build a
  roadmap §8 DEFERRED item — in particular the restaurant-card "map preview" stays post-v1; this
  phase is ONLY the anchor-selection map on Create Room.
- THE BACKEND IS FROZEN: no new migration, no new/changed RPC or Edge Function, and NO change to
  the create_room request/response contract. The map only changes HOW anchor_lat/anchor_lng are
  produced; they are still validated by @munch/core (latSchema/lngSchema) on both client and
  server. If you think you need a migration or a contract change, STOP and flag it.
- RESOLVED DECISIONS (do not relitigate): placement = Create Room only (lobby gets a read-only
  anchor/radius, no editable map); map stack = MapLibre + free OpenStreetMap raster tiles (no
  paid key; OSM attribution must show); pin model = fixed center pin (anchor = map center on
  move-end); NO geocoding/search (map-pick only, anchor_label stays optional free text);
  geolocation is opt-in and must NEVER block room creation.
- Shared, platform-agnostic geo math lives in @munch/core (unit-tested, no RN/DOM imports). Map
  components are built per-platform (no react-native-web, 09-design-system §3). Circle/pin styling
  comes from @munch/ui tokens (brand fill, heat stroke) — never hardcode hex.
- Make the smallest change that satisfies the task. TypeScript strict everywhere; no business
  logic or data access in components (CLAUDE.md §4).
- If you change behavior a doc (or an in-code comment / JSDoc) describes, update it in the same
  change (CLAUDE.md §1).
- When done, run the stated acceptance checks and report their actual output.
```

---

## Prompt 1 — Dependencies & native config (web maplibre-gl; mobile MapLibre RN + expo-location; shared OSM style)

```
Goal: add the map/geolocation dependencies and native configuration, and define the OSM tile
style + attribution ONCE so both apps share it. Foundational; the map components depend on it.
Reference: CLAUDE.md §8 (new deps need a stated need — approved here for exactly these), §3
(keys), docs/05-folder-structure.md, docs/08-tech-stack.md §"Maps/geo".

Context: apps/web is Next.js; apps/mobile is Expo (scheme "munch"). Neither has a map lib today.
Web geolocation uses the built-in navigator.geolocation (no dep). MapLibre React Native needs
native code, so Expo Go will not run it — a dev build is required.

Deliver:
- Web (apps/web): add `maplibre-gl`. Import its CSS where the map mounts (or globally). No other
  web dep (geolocation is built in).
- Mobile (apps/mobile): add `@maplibre/maplibre-react-native` and `expo-location`.
    • Add the MapLibre RN Expo config plugin to app.json / app.config so it links natively, and
      document in the file (or README) that a DEV BUILD is required (not Expo Go).
    • Add location permission strings with friendly copy ("Munch uses your location to center the
      map on you"): iOS NSLocationWhenInUseUsageDescription; Android ACCESS_FINE_LOCATION /
      ACCESS_COARSE_LOCATION.
- Shared OSM map config (defined ONCE, consumed by both apps — e.g. a small export in
  packages/ui or a shared config module; do not duplicate per app):
    • The MapLibre raster style JSON using https://tile.openstreetmap.org/{z}/{x}/{y}.png
      (256px tiles).
    • The required attribution string "© OpenStreetMap contributors" (must render on the map).
    • A neutral DEFAULT_MAP_CENTER fallback used when geolocation is denied/unavailable.
- Confirm no Places/service-role key is referenced anywhere in apps/* or packages/* as part of
  this change (OSM needs none).

Done when: `pnpm install` succeeds; `pnpm --filter @munch/web build` and `pnpm --filter
@munch/mobile typecheck` pass; the OSM style + attribution + default-center constant exists once
and is importable by both apps; the mobile native config (plugin + permission strings) is present
and the dev-build requirement is documented.
```

---

## Prompt 2 — Core: radius-circle + zoom geo math (pure, tested)

```
Goal: add platform-agnostic geo helpers to @munch/core so both map components render an accurate
amber radius ring and keep it visible. Pure functions, unit-tested, NO React/RN/DOM imports.
Reference: docs/08-tech-stack.md §"Maps/geo" (distance/geo math belongs in @munch/core),
docs/06-coding-standards.md §3/§10, CLAUDE.md §4. Depends on Prompt 1 only for ordering.

Context: @munch/core already owns the radius constants (RADIUS_MIN_M=500, RADIUS_MAX_M=20_000,
DEFAULT_RADIUS_M=3_000 in src/constants.ts) and other domain math. Add a small geo module beside
them and export it from the package barrel.

Deliver:
- circlePolygon(center: { lat: number; lng: number }, radiusM: number, steps = 64):
  GeoJSON.Feature<Polygon> — a CLOSED polygon approximating a circle of radiusM around center,
  correct for the lng↔meters scaling at that latitude (cos(lat) longitude correction). This is the
  MapLibre `fill` source used on both platforms.
- zoomForRadius(radiusM: number, viewportPx: number): number — the web-Mercator zoom at which a
  circle of radiusM comfortably fits a square viewport of viewportPx, used for the initial zoom
  and when the radius changes. Monotonic (larger radius → lower zoom), bounded to sane min/max.
- Clamp radiusM to [RADIUS_MIN_M, RADIUS_MAX_M] in both helpers; reuse the existing constants.
- Export both (and any GeoJSON types needed) from the @munch/core barrel.
- Tests (src/*.test.ts): the polygon is closed and has steps+1 coordinates; every vertex sits
  ~radiusM from center within tolerance at a LOW latitude (e.g. 1°) and a HIGH latitude (e.g.
  60°); zoomForRadius is monotonic and bounded; edge cases at RADIUS_MIN_M and RADIUS_MAX_M; a
  radius below/above the bounds is clamped.

Done when: `pnpm --filter @munch/core typecheck` and `pnpm --filter @munch/core test` pass; the
helpers import cleanly from "@munch/core"; no platform (RN/DOM) import leaks into the package.
```

---

## Prompt 3 — Web: AnchorMap component + wire into Create Room (replace lat/lng inputs)

```
Goal: build a presentational web AnchorMap (MapLibre GL JS) and wire it into the Create Room form,
replacing the manual Latitude/Longitude inputs, with geolocation centering and an amber radius
circle bound to the existing RadiusSlider.
Reference: docs/10-pages.md §3.3, docs/09-design-system.md §7 (Map primitive, amber tokens),
docs/06-coding-standards.md §9, CLAUDE.md §2 (§2.1/§2.2), §4. Depends on Prompts 1–2. Can run in
parallel with Prompt 4. Study apps/web/src/features/room/create-room-form.tsx and
apps/web/src/components/radius-slider.tsx first.

Deliver:
- A new presentational component (e.g. src/components/anchor-map.tsx) using maplibre-gl:
    • Props: { radiusM: number; initialCenter?: {lat,lng}; onAnchorChange: (lat, lng) => void }.
      NO data access, NO domain logic, NO provider call (CLAUDE.md §4) — it only emits the center.
    • FIXED CENTER PIN: a pin element pinned to the map's visual center; on the map "moveend"
      event read map.getCenter() and call onAnchorChange. Anchor is always the map center.
    • AMBER RADIUS CIRCLE: a GeoJSON `fill` layer from @munch/core circlePolygon(center, radiusM),
      styled with @munch/ui brand (low-opacity fill) + heat (stroke). Regenerate when the center
      moves or radiusM changes; set initial zoom from zoomForRadius and re-fit when radiusM changes
      so the ring stays visible.
    • Use the shared OSM style + render the "© OpenStreetMap contributors" attribution (Prompt 1).
    • GEOLOCATION on mount: request navigator.geolocation once; on success center the map there
      (default anchor) and emit it; on denial/unavailable center on DEFAULT_MAP_CENTER and let the
      host pan. NEVER block; do not re-prompt in a loop.
- Wire into create-room-form.tsx:
    • REMOVE the two manual Latitude / Longitude <Field> inputs (and the toNumber-for-lat/lng
      usage). Keep the optional anchor_label text input. Keep the RadiusSlider.
    • Drive the map's radiusM from the same radius state the slider sets (bidirectional: slider ↔
      circle). Feed the map's onAnchorChange into anchor_lat/anchor_lng state.
    • Submit still builds the request and validates with createRoomRequestSchema (latSchema/
      lngSchema unchanged). A not-yet-set anchor should be handled gracefully (default from
      geolocation/center), not a NaN.
    • Remove the now-stale "geocoding/map is deferred … host enters lat/lng" comment.

Done when: `pnpm dev:web` runs end-to-end against local Supabase: the host sets the anchor by
dragging the map under the center pin, the map centers on their location when permitted (default
otherwise), dragging the slider (500 m–20 km) resizes the amber circle live and it stays visible,
OSM attribution shows, room creation succeeds via the unchanged create_room contract, and NO
provider call fires on any map/slider interaction; the lat/lng text inputs are gone.
`pnpm --filter @munch/web build` passes.
```

---

## Prompt 4 — Mobile: AnchorMap component + wire into Create Room (twin of Prompt 3)

```
Goal: build the Expo/RN twin AnchorMap (@maplibre/maplibre-react-native) at parity with web and
wire it into the mobile Create Room form, with expo-location geolocation and the amber radius
circle bound to the RadiusSlider.
Reference: docs/10-pages.md §3.3, docs/09-design-system.md §7, docs/06-coding-standards.md §6 (no
RN-form-conflicting semantics), CLAUDE.md §2/§4. Depends on Prompts 1–2. Can run in parallel with
Prompt 3 and must match Prompt 3's component contract (parity is a project norm). Study
apps/mobile/src/features/room/create-room-form.tsx and
apps/mobile/src/components/ui/radius-slider.tsx first.

Deliver:
- A new RN component (e.g. src/components/ui/anchor-map.tsx) using @maplibre/maplibre-react-native:
    • Same props as web: { radiusM; initialCenter?; onAnchorChange }. Presentational only.
    • FIXED CENTER PIN over the map center; read the center on the region-changed/did-change
      event → onAnchorChange.
    • AMBER RADIUS CIRCLE as a ShapeSource + FillLayer from @munch/core circlePolygon(center,
      radiusM), styled via the @munch/ui-backed theme (brand fill, heat stroke); regenerate on
      center/radius change; initial + re-fit zoom from zoomForRadius.
    • Use the shared OSM style and render the "© OpenStreetMap contributors" attribution.
    • GEOLOCATION on mount with expo-location: request foreground permission once; on grant center
      on the device location and emit it; on denial/unavailable center on DEFAULT_MAP_CENTER and
      allow panning. NEVER block room creation.
- Wire into the mobile create-room-form.tsx:
    • REMOVE the manual latitude/longitude inputs; keep the optional anchor_label input and the
      RadiusSlider; bind radiusM (slider ↔ circle) and feed onAnchorChange into anchor_lat/
      anchor_lng. Submit validates with createRoomRequestSchema.
    • Remove the stale "geocoding/map is deferred … host enters lat/lng" comment.

Done when: `pnpm dev:mobile` runs in a DEV BUILD at parity with web — anchor set via the map,
geolocation centering with safe fallback, live circle resize that stays visible, OSM attribution,
room creation via the unchanged contract, no provider call on map/slider interaction; the manual
lat/lng inputs are gone; `pnpm --filter @munch/mobile typecheck` passes.
```

---

## Prompt 5 — Lobby: read-only anchor/radius + regression check (both apps)

```
Goal: reflect the new model in the lobby (placement is Create Room ONLY — the lobby gets NO
editable map) and confirm nothing regressed.
Reference: docs/10-pages.md §3.5, CLAUDE.md §2.2 (host-controlled), §4. Depends on Prompts 3–4. Study
apps/web/src/features/room/lobby-filters-panel.tsx and the mobile twin, plus FiltersSummary.

Deliver:
- In the lobby filters/summary (both apps), surface the chosen ANCHOR (anchor_label, and the
  radius) READ-ONLY for non-host members, alongside the existing read-only filters summary. The
  host keeps the existing editable radius in the lobby filters panel (it still snapshots into
  start_session). Do NOT add an editable or interactive map to the lobby or session.
- Verify the unrelated lobby paths are untouched: presence/squad grid, the host-left ended state
  (!room.isActive), and Start Session.

Done when: a non-host sees the anchor + radius read-only in the lobby; the host's lobby radius
edit still works and still feeds start_session; no editable map appears in a room; existing lobby
tests pass and both apps typecheck/build.
```

---

## Prompt 6 — Tests, doc/comment reconciliation, and Phase 4.6 exit verification

```
Goal: lock down the geo math, finish reconciling docs/comments with the implemented choices, and
verify the exit criterion + green CI.
Reference: docs/06-coding-standards.md (§10 testing, §11 CI), docs/07-initial-roadmap.md §6.6
(Phase 4.6 exit), CLAUDE.md §1 (code/doc parity), §3. Depends on Prompts 1–5.

Deliver:
- Tests: confirm the Prompt 2 @munch/core geo tests exist and pass (closed polygon, radius
  accuracy at low/high latitude, zoomForRadius monotonic/bounded, clamping at the bounds). No test
  hits a real tile server or geolocation.
- CI guard: confirm the existing secret-leak guard still rejects the provider/service-role key
  pattern under apps/* and packages/*, and that the new map work introduced no provider/Places key
  there (OSM needs none).
- Doc / comment reconciliation (same change, CLAUDE.md §1):
    • docs/08-tech-stack.md §"Maps/geo": the ANCHOR-selection map is now in scope (MapLibre + OSM);
      explicitly note the restaurant-card "map preview" stays post-v1.
    • docs/01-product-specification.md deferred list: keep only the card "map preview" as deferred;
      do not imply the anchor map is deferred.
    • docs/10-pages.md §3.3 (Create Room): the anchor is set via a map + geolocation, not manual
      lat/lng.
    • docs/09-design-system.md §7: add an AnchorMap / Map primitive (fixed center pin, amber radius
      circle, OSM attribution).
    • In-code comments: the create-room-form "geocoding/map is deferred … host enters lat/lng"
      comments are removed on BOTH apps (Prompts 3/4); confirm none remains. The RadiusSlider JSDoc
      stays accurate.
    • CLAUDE.md: no §9 open-decision change is needed; if any §1–§8 statement now mismatches reality
      (e.g. a maps reference), fix it. Do NOT add new rules beyond what changed.

Done when: `pnpm typecheck && pnpm lint && pnpm test && pnpm build` is green; the @munch/core geo
tests pass; no doc/comment claims manual lat/lng or "map is post-v1" for the anchor while the card
map-preview deferral is still recorded; and the manual exit check holds — on both apps a host sets
the anchor on a geolocated map, the amber circle tracks the slider 500 m–20 km, room creation
succeeds via the unchanged create_room contract, no provider call fires on map/slider interaction,
and the lobby shows the anchor/radius read-only.
```
