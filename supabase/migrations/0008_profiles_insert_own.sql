-- 0008_profiles_insert_own.sql
-- Phase 1 optional accounts: let a signed-in user create their OWN profile row, completing the
-- guest->account upgrade (api-client ensureProfile upserts here after the email is confirmed).
-- Mirrors docs/03-database-schema.md §3.1 ("a user may select/update only their own profile") —
-- 0003 created profiles_select_own + profiles_update_own but no insert policy, so a fresh
-- account could not write its profile. CLAUDE.md §3: a member only reads/writes their own rows.
-- Migrations are immutable once applied (CLAUDE.md §6): never edit this file, add another.
--
-- Anon gating lives in the app/auth helper, NOT the DB: an anonymous user is also the
-- `authenticated` role (they hold a JWT with is_anonymous=true), so this policy alone would let
-- one insert a profile. We do NOT insert on anonymous sign-in — the api-client only upserts a
-- profile after auth.updateUser({ email }) has converted the user to a permanent account
-- (ensureProfile checks user.is_anonymous first). Guests stay profile-less (CLAUDE.md §3:
-- guests are ephemeral; only signed-in users persist). Hardening this in RLS via the
-- is_anonymous JWT claim is a possible follow-up; it is not required for Phase 1.

create policy profiles_insert_own on profiles
  for insert to authenticated
  with check ((select auth.uid()) = id);
