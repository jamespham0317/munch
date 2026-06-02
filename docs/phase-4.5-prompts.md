# Phase 4.5 — Account Auth (email+password & Google OAuth): Agent Prompts

**Project:** Munch
**Source:** `docs/07-initial-roadmap.md` §6.5 (Phase 4.5)
**Purpose:** Phase 4.5 broken into sequential, self-contained prompts for a Claude Code agent.

---

## How to use this

Each prompt below is dependency-ordered. Run them in sequence. Prompts 4 (web) and 5 (mobile)
can run in parallel once Prompts 1–3 are done.

**Prepend the shared preamble to every prompt.**

Phase 4.5 **replaces the account auth method** (roadmap §6.5). Phases 1–4 are done; the
product works end-to-end with anonymous guests and an **email-OTP** account path plus an
**in-place guest→account upgrade**. Phase 4.5 swaps that account path for two real methods —
**email + password** (register, sign in, email confirmation, password reset) and **Google
OAuth** — and **confines all authentication to outside a room**. It is almost entirely a
**client + auth-config** change: there is **no new table, no new migration, and no new
RPC/Edge Function**. The load-bearing rule this phase introduces is **no mid-room sign-in**:
once a member has joined a room (lobby **or** active session) their identity is fixed for that
room, and the in-place guest→account upgrade is **removed**.

### Resolved decisions driving this phase (do not relitigate)

- **Remove the guest→account upgrade entirely.** Sign in / register / Google happen only
  **before** joining a room, always as a fresh or existing real account (its own `auth.uid()`).
  A member who joined a room as a guest **stays a guest for that room**. There is no in-place
  anonymous-identity conversion anymore.
- **"Mid-room" = lobby AND session.** Auth lives only on the **home/landing** surface (and the
  standalone `/history` screen, which is not inside a room). No auth control appears in a room.
- **Standard email completeness:** register + sign in, **plus email confirmation on register**
  and a **password-reset** path. (Not minimal; not deferred to Phase 5.)

### What Phases 1–4 already left in place (build on this, don't rebuild)

- **The guest path is correct and stays.** `signInAnonymously` / `ensureGuestSession`
  (`packages/api-client/src/auth.ts`) mint and reuse the anonymous session that backs a
  `room_members` row; `ensureGuestSession` is idempotent so create→lobby and join→lobby keep a
  stable `auth.uid()`. **Do not touch the guest flow** — Phase 4.5 only changes the *account*
  path layered beside it.
- **`profiles` + RLS already support real accounts.** The `profiles` table (0002),
  `profiles_insert_own` / `profiles_update_own` (0003) and the explicit insert policy (0008)
  let any **non-anonymous** signed-in user upsert their own profile (`id = auth.uid()`).
  Password and Google accounts are non-anonymous, so they work under the **existing** policies —
  **no migration is needed.** `ensureProfile` (api-client) already gates on `is_anonymous`
  (guests get no profile) and is the app-side gate the insert policy relies on. **Keep
  `ensureProfile`; reuse it as the profile writer for both new account methods.**
- **The guest/account boundary is the presence of a `profiles` row** (docs/03 §3.1, docs/04
  §2), NOT a null `user_id`. Everything downstream (match_history written only for signed-in
  members, the history screen's "sign in to save" state) keys off this and **does not change** —
  a Google/password account has a `profiles` row exactly as an OTP account did.
- **`match_history`, filters, resolution, host-leave are all frozen.** Phase 4.5 touches none
  of the Phase 2–4 backend. A signed-in account still accrues history through the existing
  `record_match_history` path; the change is only *how* a member becomes signed-in.
- **The OTP + upgrade code to REPLACE/REMOVE is localized:**
  - api-client `auth.ts`: `signInWithEmail` (OTP) + `verifyEmailOtp` → **replace** with
    password/Google/reset helpers; `upgradeGuestToAccount` + `confirmGuestUpgrade` →
    **remove**.
  - core `validation/auth.ts`: `signInWithEmailRequestSchema` / `verifyEmailOtpRequestSchema`
    → **replace**; `upgradeGuestRequestSchema` / `confirmGuestUpgradeRequestSchema` →
    **remove**. `profileResponseSchema` stays. `validation/common.ts` `emailOtpSchema` →
    **remove** (auth is its only consumer); **add** `passwordSchema`.
  - Web/mobile `features/auth/`: `auth-panel.tsx` (two-step OTP, modes `signin|upgrade`) →
    **rework**; `use-email-sign-in.ts` → **rewrite**; `use-upgrade-guest.ts` → **delete**.
  - **Mount points:** home keeps sign-in (`apps/web/app/page.tsx:22`,
    `apps/mobile/app/index.tsx:37`); `/history` keeps sign-in (`history-view.tsx`); the
    **lobby `<AuthPanel mode="upgrade" />` is REMOVED** (`apps/web/src/features/room/lobby-view.tsx:104`,
    `apps/mobile/src/features/room/lobby-view.tsx:124`) — that mount is the mid-room sign-in
    this phase forbids.
- **Supabase auth config already half-assumes the old flow.** `supabase/config.toml` has
  `[auth]` (anonymous sign-ins on; `minimum_password_length = 6`), `[auth.email]`
  (`enable_confirmations = false`), an `[auth.external.apple]` block (disabled) but **no
  Google block**, and comments on `enable_anonymous_sign_ins` / `enable_manual_linking` that
  describe the **removed** upgrade path. Phase 4.5 reconciles these (Prompt 3).
- **Mobile has no OAuth/redirect/persistence infra yet.** `apps/mobile` deps include
  `expo-linking` but **not** `expo-web-browser` / `expo-auth-session`; the scheme is `munch`
  (`app.json`); the Supabase client is **in-memory** (no AsyncStorage). Web's client relies on
  supabase-js default URL session detection. Prompt 5 adds the minimal mobile OAuth pieces.

### No new migration / no new endpoints (decide once, here)

- **No SQL migration.** `profiles` + its RLS already permit non-anonymous account creation.
  Do not add a table, policy, or RPC. If you believe one is needed, STOP and flag it — it
  almost certainly is not.
- **No new RPC or Edge Function.** All work is in `@munch/core` (schemas), `@munch/api-client`
  (Supabase Auth SDK calls), the two apps (UI), and `supabase/config.toml` (provider config).
- **Auth SDK calls only, mapped to the safe `ApiError` shape.** Every helper returns the
  existing `ClientResult<T>`; raw GoTrue errors are mapped via `toApiError`, never surfaced
  (docs/06 §9). A bad password / unconfirmed email maps to `UNAUTHENTICATED`; keep the existing
  `ErrorCode` set (do not invent new codes).

### Pinned Phase 4.5 decisions (so the agent doesn't relitigate them)

- **Email register flow with confirmation:** `signUp({ email, password, options.data:
  { display_name } })` carries the chosen name in user metadata so it survives the
  confirmation round-trip; with `enable_confirmations = true` the user must confirm by email
  before a session exists. After confirmation + `signInWithPassword`, call `ensureProfile`
  (using the metadata name) to write the `profiles` row. Returning users just
  `signInWithPassword`.
- **Google OAuth:** `signInWithOAuth({ provider: 'google', options: { redirectTo } })`. On
  **web**, the standard redirect + supabase-js URL detection establishes the session; on
  **mobile**, open the URL with `expo-web-browser` `openAuthSessionAsync`, capture the
  `munch://` redirect, and `exchangeCodeForSession(...)` (PKCE). On first Google sign-in,
  `ensureProfile` uses the Google display name (`user_metadata.full_name`/`name`).
- **Password min length = 8.** Add `passwordSchema = z.string().min(8)` in core and set
  `minimum_password_length = 8` in `config.toml` so client and server agree (the schema is the
  source of truth — docs/06 §3). Do not add complexity/symbol rules (keep
  `password_requirements = ""`); that is a Phase 5 hardening knob, not v1.
- **No mid-room sign-in is enforced by surface placement, not a new guard.** The only
  mid-room auth surface today is the lobby upgrade panel; removing it (and adding **no** auth
  control to lobby or session) is the enforcement. Home and `/history` (both outside a room)
  keep sign-in. Do not add an auth affordance anywhere a member is already in a room.
- **`AuthPanel` modes become `signin | register`** (a single panel that toggles between
  signing in and registering, with a "Continue with Google" button and a "Forgot password?"
  link). The `upgrade` mode is gone. Home and `/history` mount `mode="signin"`.
- **Password reset is a real but minimal flow:** `resetPasswordForEmail(email, { redirectTo })`
  sends a recovery link; the redirect target (web route / mobile deep link) lands the user on a
  "set a new password" screen that calls `updateUser({ password })` on the recovery session.
  Google accounts don't get a reset path (they manage their own credentials).
- **Mobile session persistence is added for ACCOUNTS only, as the one new piece of infra.** A
  real account should survive an app relaunch (and OAuth PKCE needs storage across the browser
  round-trip), so wire an AsyncStorage adapter into the **shared api-client client factory**
  (an optional `storage`/`flowType` option), passed from `apps/mobile/src/lib/supabase.ts`.
  Guests remain ephemeral by nature. Keep the storage adapter in the factory (CLAUDE.md §4),
  not a second client. This is the *only* dependency/infra addition in the phase — keep it
  minimal (`@react-native-async-storage/async-storage`, `expo-web-browser`; reuse
  `expo-linking`).
- **Deferred stays deferred (roadmap §8):** no additional OAuth providers (Apple/etc.), no
  magic-link, no account-linking of an anonymous guest to an account, no MFA, no swipe-history
  personalization. `enable_manual_linking` stays `false`.

### Phase 4.5 maps to the roadmap §6.5 bullets + the exit criterion

- Email+password register/sign-in + confirmation + reset → Prompt 1 (schemas), Prompt 2
  (api-client helpers), Prompt 3 (config: confirmations on, password length), Prompts 4/5
  (register/sign-in/reset UI)
- Google OAuth (web + mobile) → Prompt 2 (`signInWithGoogle` helper + factory flowType/storage),
  Prompt 3 (`[auth.external.google]` config + redirect URLs + secret env), Prompts 4/5
  ("Continue with Google" + redirect handling)
- No mid-room sign-in → Prompts 4/5 (remove the lobby upgrade panel; delete `use-upgrade-guest`;
  add no auth surface inside a room)
- Remove in-place upgrade → Prompt 1 (drop upgrade schemas), Prompt 2 (drop upgrade helpers),
  Prompts 4/5 (drop upgrade UI/hooks)
- Tests + doc/comment reconciliation → Prompt 6

**Exit check (after all 6):** a user can **register with email+password** (and is required to
confirm via the emailed link, captured by Inbucket locally) or **sign in with Google** from the
**home screen**, then create/join a room as a signed-in member; the **auth surface is absent
inside a room** (lobby + session) and a guest **cannot upgrade mid-room**; a **password reset**
round-trips to a working new password; a signed-in account **accrues match history** exactly as
before; guests remain ephemeral. CI is green and no OTP/upgrade code or doc text remains.

---

## Shared preamble — prepend to every prompt

```
You are working in the Munch monorepo. Before starting:
- Read CLAUDE.md (root) and the docs/ files it points to that are relevant to this task —
  especially docs/04-api-specification.md §2 (Auth), which has ALREADY been reconciled to the
  Phase 4.5 model (email+password, Google OAuth, no mid-room sign-in, no guest→account
  upgrade). The code must match that spec; if code and doc disagree, the doc is the target.
- Honor the §2 invariants and §3 security rules at all times: provider/service-role keys are
  server-only and must never appear in apps/* or packages/*; only the public anon key + URL
  are read in the apps; RLS on every table; domain rules live in packages/core, never
  duplicated.
- This is Phase 4.5 (Account auth) per docs/07-initial-roadmap.md §6.5. Phases 1–4 are DONE —
  do NOT rebuild rooms, the match mechanic, resolution, filters, or match_history. Do NOT
  build any roadmap §8 DEFERRED item: no additional OAuth providers (Apple/etc.), no
  magic-link, no anonymous-account linking, no MFA, no personalization.
- THE GUEST FLOW IS UNCHANGED: signInAnonymously / ensureGuestSession and the
  guest-stays-a-guest default are correct. You are only replacing the *account* path beside it.
- NO MID-ROOM SIGN-IN (the load-bearing rule of this phase): authentication is available ONLY
  on the home/landing surface and the standalone /history screen — never in a lobby or an
  active session. A guest who joined a room stays a guest for that room. The in-place
  guest→account upgrade is REMOVED.
- THE GUEST/ACCOUNT BOUNDARY IS THE PRESENCE OF A profiles ROW (not a null user_id). A
  password or Google account has a profiles row exactly as the old OTP account did; everything
  downstream (match_history-for-signed-in-only, the history screen's "sign in to save" state)
  keys off this and must keep working unchanged.
- NO NEW MIGRATION and NO NEW RPC/EDGE FUNCTION: profiles + its existing RLS already permit
  non-anonymous account creation. This phase is @munch/core schemas + @munch/api-client Auth
  SDK calls + the two apps' UI + supabase/config.toml only. If you think you need a migration,
  STOP and flag it.
- Auth helpers return the existing ClientResult<T>; map raw GoTrue errors via toApiError to the
  safe ApiError shape (docs/06 §9). Reuse the existing ErrorCode set — do not invent codes. A
  bad password / unconfirmed email maps to UNAUTHENTICATED.
- Zod schemas in @munch/core are the source of truth (docs/06 §3); password min length is 8 and
  config.toml minimum_password_length must match. Map snake_case wire shapes to camelCase at the
  api-client boundary (docs/06 §5).
- Make the smallest change that satisfies the task. TypeScript strict everywhere; no business
  logic in components (CLAUDE.md §4).
- If you change behavior a doc (or a config comment / in-code JSDoc) describes, update it in the
  same change (CLAUDE.md §1).
- When done, run the stated acceptance checks and report their actual output.
```

---

## Prompt 1 — Core: password auth schemas (replace OTP, remove upgrade)

```
Goal: make @munch/core the single source of truth for the new account contracts — email+
password register/sign-in, password reset — and delete the OTP + guest-upgrade schemas. Small,
foundational change; everything else depends on it.
Reference: docs/04-api-specification.md §2 (Auth — already reconciled to the new model),
docs/06-coding-standards.md (§3 Zod-as-source-of-truth, §10 testing), CLAUDE.md §3.

Context: src/validation/auth.ts currently has signInWithEmailRequestSchema +
verifyEmailOtpRequestSchema (fresh OTP account) and upgradeGuestRequestSchema +
confirmGuestUpgradeRequestSchema (in-place upgrade), plus profileResponseSchema.
src/validation/common.ts has emailSchema and emailOtpSchema. Guest flow schemas are elsewhere
and stay.

Deliver:
- src/validation/common.ts:
    • Add passwordSchema = z.string().min(8) (the source of truth for the 8-char minimum;
      Prompt 3 sets config.toml minimum_password_length to 8 to match). Short JSDoc.
    • REMOVE emailOtpSchema (auth was its only consumer). Update the file header comment that
      references the 6-digit OTP.
- src/validation/auth.ts — rewrite to the new contracts (snake_case wire shapes, docs/06 §5):
    • registerRequestSchema = { email, password, display_name } (emailSchema / passwordSchema /
      displayNameSchema).
    • signInRequestSchema = { email, password }.
    • passwordResetRequestSchema = { email }.
    • updatePasswordRequestSchema = { password }.
    • Keep profileResponseSchema unchanged.
    • DELETE signInWithEmailRequestSchema, verifyEmailOtpRequestSchema, upgradeGuestRequestSchema,
      confirmGuestUpgradeRequestSchema and their exported types.
    • Rewrite the file header JSDoc to describe email+password + Google (no OTP, no in-place
      upgrade); note Google needs no request schema (it is a redirect, not a form post).
  Export the new schemas + z.infer types via the existing validation index barrel; remove the
  deleted exports from the barrel.
- Grep the monorepo for the removed symbol names (signInWithEmailRequestSchema,
  verifyEmailOtpRequestSchema, upgradeGuestRequestSchema, confirmGuestUpgradeRequestSchema,
  emailOtpSchema) — Prompts 2/4/5 will fix the app/api-client usages, but list every hit so
  nothing is missed.
- Tests (src/validation/*.test.ts, new or extended): registerRequestSchema rejects a <8-char
  password and a bad email and accepts a valid trio; signInRequestSchema requires both fields;
  passwordResetRequestSchema requires a valid email; updatePasswordRequestSchema enforces the
  8-char floor. Do not test removed schemas.

Done when: `pnpm --filter @munch/core typecheck` and `pnpm --filter @munch/core test` pass; the
new schemas + types are importable from "@munch/core"; no OTP/upgrade schema remains in core;
the grep list of remaining external usages is reported.
```

---

## Prompt 2 — api-client: password + Google + reset helpers (remove upgrade); client factory

```
Goal: replace the OTP/upgrade auth helpers with email+password, Google OAuth, and password-reset
helpers, and give the shared Supabase client factory the options OAuth needs (PKCE flow + a
pluggable storage adapter). Keep the guest helpers and ensureProfile.
Reference: docs/04-api-specification.md §2 (Auth), docs/06-coding-standards.md (§5 snake↔camel,
§8 error shape, §9 no leaked auth errors), CLAUDE.md §3, §4. Depends on Prompt 1. Study
packages/api-client/src/auth.ts and src/supabase.ts first.

Deliver:
- src/auth.ts:
    • KEEP signInAnonymously, ensureGuestSession, ensureProfile unchanged in behavior. Update
      the OTP-referencing comment block above the account helpers.
    • REMOVE signInWithEmail, verifyEmailOtp, upgradeGuestToAccount, confirmGuestUpgrade.
    • ADD (each returns ClientResult<…>, mapping GoTrue errors via toApiError → UNAUTHENTICATED,
      never raw text):
        - registerWithEmailPassword(client, { email, password, displayName }) →
          client.auth.signUp({ email, password, options: { data: { display_name: displayName } } }).
          With email confirmation ON, this returns a user but no session; return a typed result
          indicating "confirmation required" (e.g. ClientResult<{ needsEmailConfirmation: boolean }>
          based on whether data.session is null). Do NOT write the profile here (no session yet).
        - signInWithEmailPassword(client, { email, password }) →
          client.auth.signInWithPassword(...); returns the Session.
        - signInWithGoogle(client, { redirectTo }) → client.auth.signInWithOAuth({ provider:
          'google', options: { redirectTo, skipBrowserRedirect: true } }) and return the
          provider URL (the caller opens it; web can also use skipBrowserRedirect:false — expose
          the option). Add a thin exchangeOAuthCode(client, code) wrapping
          client.auth.exchangeCodeForSession(code) for the mobile PKCE round-trip.
        - requestPasswordReset(client, { email, redirectTo }) →
          client.auth.resetPasswordForEmail(email, { redirectTo }).
        - updatePassword(client, { password }) → client.auth.updateUser({ password }) on the
          current (recovery) session.
        - ensureProfileFromCurrentUser(client, fallbackDisplayName?) OR extend ensureProfile so
          first-account-sign-in writes the profile using the chosen name from user_metadata
          (display_name for password accounts; full_name/name for Google), falling back to the
          arg. Keep the is_anonymous refusal (guests never get a profile). Reuse the existing
          profiles upsert + mapProfileRow.
- src/supabase.ts (the createSupabaseClient factory): add optional { storage?, flowType? }
  passthrough to supabase-js auth options (default flowType 'pkce' is fine for OAuth on both
  platforms; web keeps detectSessionInUrl default true; mobile will pass an AsyncStorage adapter
  in Prompt 5). Do not hardcode any platform storage here — the factory stays platform-agnostic
  (CLAUDE.md §4). Confirm no service-role/provider key is read here.
- Update the package index barrel exports (remove deleted helpers, add new ones).
- Tests (src/auth.test.ts or endpoint test style with a mocked SupabaseClient): a failed
  signInWithEmailPassword maps to a safe ApiError (UNAUTHENTICATED), never raw text;
  registerWithEmailPassword surfaces needsEmailConfirmation when signUp returns no session;
  ensureProfile still refuses while is_anonymous. Keep/adjust existing guest-session tests.

Done when: `pnpm --filter @munch/api-client typecheck` and `pnpm --filter @munch/api-client test`
pass; the new helpers are exported; no OTP/upgrade helper remains; signInAnonymously /
ensureGuestSession / ensureProfile behavior is unchanged.
```

---

## Prompt 3 — Supabase config: email confirmations, Google provider, reconcile comments

```
Goal: configure local Supabase Auth for the new model — require email confirmation, enable the
Google OAuth provider, align the password length, and fix the config comments that still
describe the removed OTP/upgrade flow. NO migration (profiles RLS already supports real
accounts).
Reference: docs/04-api-specification.md §2, docs/02-system-architecture.md §3.2/§7, CLAUDE.md §3.
Study supabase/config.toml ([auth], [auth.email], [auth.external.*]) and
supabase/functions/.env.example first.

Deliver:
- supabase/config.toml:
    • [auth.email]: set enable_confirmations = true (register requires email confirmation;
      locally the email is captured by Inbucket — note this in a comment). Leave
      double_confirm_changes as-is.
    • [auth]: set minimum_password_length = 8 (matches @munch/core passwordSchema). Keep
      password_requirements = "" (complexity rules are a Phase 5 hardening knob, not v1).
    • Add a [auth.external.google] block (mirror the existing [auth.external.apple] shape):
        enabled = true
        client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"
        secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)"
        skip_nonce_check = true   # required for local sign-in with Google (see the apple block's note)
      Do NOT inline any real client id/secret — env substitution only (CLAUDE.md §3).
    • additional_redirect_urls: add the app redirect targets the OAuth/reset flows use — the web
      callback (e.g. http://127.0.0.1:3000/auth/callback) and the mobile deep link
      (munch://auth/callback). Keep site_url as the web dev URL.
    • Reconcile the now-wrong comments: the enable_anonymous_sign_ins comment and the
      enable_manual_linking comment both describe the REMOVED guest→account upgrade
      (updateUser({email}) + verifyOtp('email_change')). Rewrite them: anonymous sign-ins still
      back the guest flow; manual linking stays false because Phase 4.5 does NOT link an
      anonymous guest to an account (accounts are created fresh, outside a room). Remove the OTP
      framing.
- supabase/functions/.env.example (and .env.local if present, without real secrets): document
  SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID and SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET as the
  Google OAuth credentials, with a one-line note that real values are local/dev only and never
  committed. (These are auth-config env, distinct from the provider/service-role keys, but the
  same "server-side env only" rule applies.)

Done when: `supabase start` (or `supabase db reset`) loads config cleanly; the [auth.external.google]
block, enable_confirmations=true, and minimum_password_length=8 are present; no real OAuth secret
is committed; no config comment still describes the OTP/upgrade flow.
```

---

## Prompt 4 — Web: password+Google auth UI, password reset, remove mid-room sign-in

```
Goal: the Next.js side of Phase 4.5 — rework AuthPanel to email+password + "Continue with
Google" + register toggle + "Forgot password?", add the password-reset route, handle the OAuth
callback, and REMOVE the lobby (mid-room) sign-in surface. Keep home + /history sign-in.
Reference: docs/04-api-specification.md §2, docs/01-product-specification.md §10,
docs/05-folder-structure.md §4, docs/06-coding-standards.md §3/§9. Depends on Prompts 1–3. Can
run in parallel with Prompt 5. Reuse existing patterns (TanStack Query, the schemas); extend,
don't rewrite the unrelated screens.

Deliver:
- src/features/auth/auth-panel.tsx: rework from the two-step OTP panel (modes signin|upgrade) to
  modes signin|register:
    • Email + password fields validated against signInRequestSchema / registerRequestSchema
      (register also takes display_name). A toggle switches sign-in ⇄ register.
    • A "Continue with Google" button calling the Google OAuth helper (redirectTo =
      /auth/callback). On web, letting supabase-js do the redirect (skipBrowserRedirect:false)
      is simplest.
    • A "Forgot password?" link to the reset-request route.
    • Register success shows a "Check your email to confirm" state (confirmation is required);
      sign-in success shows signed-in. On first signed-in session, ensure the profiles row
      (ensureProfile) with the chosen/Google name.
    • DROP the upgrade mode entirely.
- src/features/auth/use-email-sign-in.ts: rewrite to wrap registerWithEmailPassword /
  signInWithEmailPassword / signInWithGoogle / requestPasswordReset (TanStack mutations). DELETE
  src/features/auth/use-upgrade-guest.ts and any import of it.
- OAuth callback + reset routes (App Router, OUTSIDE any room path):
    • app/auth/callback/page.tsx: completes the OAuth/redirect sign-in (supabase-js detects the
      session from the URL) and ensures the profile, then routes home.
    • app/auth/reset/page.tsx: request form (email → requestPasswordReset, redirectTo the
      update route) AND the update step (on the recovery session, updatePassword({ password }));
      a recovery redirect lands here. Keep it minimal and validated by the core schemas.
- REMOVE the mid-room sign-in surface: delete the `{isGuest ? <AuthPanel mode="upgrade" /> : null}`
  block (and its explanatory comment about keeping membership via the same user_id) from
  src/features/room/lobby-view.tsx. Do NOT add any auth control to the lobby or session — a guest
  in a room stays a guest. (use-current-user may still drive the history screen's signed-in
  state; only the lobby upgrade affordance is removed.)
- Keep home (app/page.tsx) and history (features/history/history-view.tsx) mounting
  <AuthPanel mode="signin" /> — both are outside a room.
- No new NEXT_PUBLIC_* secret; the provider/service-role keys must not appear here. Components
  stay thin; logic lives in api-client/core.

Done when: `pnpm dev:web` runs end-to-end against local Supabase: a user registers
(email+password), receives the confirmation email in Inbucket, confirms, signs in, and lands
signed-in; "Continue with Google" completes via /auth/callback (with local Google creds
configured); "Forgot password?" round-trips to a working new password; a guest in a lobby sees
NO sign-in/upgrade control; home + /history still offer sign-in. `pnpm --filter @munch/web build`
passes; no reference to the removed OTP/upgrade symbols remains.
```

---

## Prompt 5 — Mobile: password+Google auth UI, OAuth redirect + session persistence, remove mid-room sign-in

```
Goal: the Expo side of Phase 4.5 at parity with web — AuthPanel email+password + Google
(expo-web-browser redirect) + register toggle + reset, the OAuth deep-link round-trip, account
session persistence (AsyncStorage), and REMOVAL of the lobby mid-room sign-in. Keep home +
history sign-in.
Reference: docs/04-api-specification.md §2, docs/01-product-specification.md §10,
docs/05-folder-structure.md §3, docs/06-coding-standards.md §6 (no RN-form conflicts). Depends
on Prompts 1–3. Can run in parallel with Prompt 4. Reuse the Phase 1–4 mobile auth features;
extend, don't rewrite unrelated screens.

Deliver:
- Session persistence (the one new infra piece): add @react-native-async-storage/async-storage
  and pass an AsyncStorage adapter (+ flowType:'pkce') from apps/mobile/src/lib/supabase.ts into
  the shared createSupabaseClient factory (the option added in Prompt 2). Update the file's
  "no AsyncStorage yet / in-memory" comment: accounts now persist across launches and OAuth PKCE
  needs storage across the browser round-trip; guests remain ephemeral by nature. Do NOT create a
  second client.
- src/features/auth/auth-panel.tsx: rework to modes signin|register with RN-appropriate controls
  (no <form> semantics that conflict with RN — docs/06 §6): email + password (+ display_name on
  register) validated against the core schemas; a "Continue with Google" button; a "Forgot
  password?" link. Register success → "check your email to confirm" state; sign-in success →
  signed-in + ensureProfile. DROP the upgrade mode.
- src/features/auth/use-email-sign-in.ts: rewrite to wrap registerWithEmailPassword /
  signInWithEmailPassword / the Google flow / requestPasswordReset. DELETE
  src/features/auth/use-upgrade-guest.ts and its imports.
- Google OAuth round-trip (add expo-web-browser; reuse expo-linking): build redirectTo from the
  munch:// scheme (e.g. Linking.createURL('auth/callback') → munch://auth/callback), call the
  signInWithGoogle helper with skipBrowserRedirect, open the returned URL with
  WebBrowser.openAuthSessionAsync(url, redirectTo), parse the returned ?code, and call
  exchangeOAuthCode(code). Ensure munch://auth/callback is covered by app.json scheme (it is —
  scheme "munch"); confirm config.toml additional_redirect_urls includes it (Prompt 3).
- Password reset screen (app/auth/reset.tsx or the routed equivalent, OUTSIDE any room): request
  (email → requestPasswordReset, redirectTo a munch:// reset deep link) and update
  (updatePassword on the recovery session). Minimal, schema-validated.
- REMOVE the mid-room sign-in: delete the `{isGuest ? <AuthPanel mode="upgrade" /> : null}` block
  (and its comment) from src/features/room/lobby-view.tsx. Add NO auth control to lobby/session.
- Keep home (app/index.tsx) and history (features/history/history-view.tsx) mounting
  <AuthPanel mode="signin" /> — both outside a room.
- Reuse EXPO_PUBLIC_SUPABASE_* env only; no provider/service-role key anywhere. Keep logic in
  api-client/core; components thin.

Done when: `pnpm dev:mobile` boots in Expo; a user can register (email+password) and is told to
confirm by email, then sign in and land signed-in; "Continue with Google" completes via the
munch:// deep link and exchangeCodeForSession; the session survives an app relaunch (AsyncStorage);
"Forgot password?" round-trips to a new password; a guest in a lobby sees NO sign-in/upgrade
control; home + history still offer sign-in; the app typechecks. No removed OTP/upgrade symbol
remains.
```

---

## Prompt 6 — Tests, doc/comment reconciliation, and Phase 4.5 exit verification

```
Goal: lock down the new auth behavior with tests, finish reconciling docs/comments with the
implemented choices, and verify the exit criterion + green CI.
Reference: docs/06-coding-standards.md (§10 testing, §11 CI), docs/07-initial-roadmap.md §6.5
(Phase 4.5 exit), docs/04-api-specification.md §2 (already reconciled — verify the code matches),
CLAUDE.md §1 (code/doc parity), §3. Depends on Prompts 1–5.

Deliver:
- Tests:
    • Core: the Prompt 1 schema tests exist and pass (password floor, register trio, reset/update
      shapes).
    • api-client: the Prompt 2 auth tests exist — failed sign-in → safe ApiError;
      register → needsEmailConfirmation; ensureProfile refuses while is_anonymous. Do NOT call a
      real auth server; mock the SupabaseClient.
    • Guard test/grep in CI scope: assert no OTP/upgrade symbol remains
      (signInWithEmail/verifyEmailOtp/upgradeGuestToAccount/confirmGuestUpgrade/emailOtpSchema/
      upgradeGuestRequestSchema/confirmGuestUpgradeRequestSchema) anywhere under packages/* and
      apps/*.
- CI: confirm .github/workflows/ci.yml still gates typecheck → lint → test → build and the
  Phase-0 secret-leak guard still rejects the provider/service-role key pattern under apps/* and
  packages/* (the new Google OAuth secret lives only in supabase auth env / config.toml env
  substitution — verify it is not committed and not referenced from apps/* or packages/*).
- Doc / comment reconciliation (same PR, CLAUDE.md §1):
    • Verify docs/04-api-specification.md §2 matches the shipped code (it was pre-reconciled);
      fix any drift (helper names, the confirmation/reset steps, the Google redirect targets).
    • docs/03-database-schema.md §3.1: confirm the profiles note reads "written on first sign-in
      when a user registers or signs in (email+password or Google), outside a room" (already
      updated) and that no text still implies an OTP/upgrade origin.
    • In-code JSDoc: the api-client auth.ts header/comment block, core validation/auth.ts and
      common.ts headers, and the app AuthPanel/use-email-sign-in comments must describe the new
      flow (no "6-digit OTP", no "guest keeps membership through an upgrade").
    • supabase/config.toml comments (from Prompt 3) no longer describe the upgrade path — confirm.
    • CLAUDE.md: no §9 open-decision change is needed. If any §1–§8 statement now mismatches
      reality (e.g. an auth reference), fix it here. Do NOT add new rules beyond what changed.
- If anything references docs/07-initial-roadmap.md §6.5 "Supersedes Phase 1 OTP flow", confirm
  that supersession is now actually true in code.

Done when: `pnpm typecheck && pnpm lint && pnpm test && pnpm build` is green; the new
core/api-client auth tests pass; the no-OTP/upgrade-symbol guard passes; docs, config comments,
and in-code JSDoc all describe the email+password + Google + no-mid-room-sign-in model; the
manual exit check holds — register+confirm, password sign-in, Google sign-in, and password reset
all work from the home screen, no auth surface appears inside a room, and a signed-in account
still accrues match history while guests stay ephemeral.
```
