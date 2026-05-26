-- seed/seed.sql
-- PHASE 0 SMOKE ARTIFACT. One restaurants row that the Phase 0 end-to-end connectivity test
-- reads under RLS from an anonymous session (via the restaurants_select_phase0_smoke policy
-- in 0003). This proves: anon auth works, RLS lets an authenticated session read, and the
-- monorepo -> api-client -> Supabase path is wired. It is NOT real provider data.
--
-- TIGHTEN/REMOVE IN PHASE 1: once restaurants are populated per-session from the provider
-- and reads are scoped to deck membership, drop this row and the permissive smoke policy.
-- (phase-0-prompts.md Prompt 3; CLAUDE.md §3 — restaurants are not a permanent local mirror.)

insert into restaurants (
  id,
  provider,
  provider_ref,
  name,
  lat,
  lng,
  rating,
  price_level,
  cuisines,
  photo_url,
  is_open_now,
  expires_at
)
values (
  '00000000-0000-0000-0000-0000000000a1',  -- fixed id so the smoke read can target it
  'seed',
  'phase0-smoke',
  'Phase 0 Smoke Test Diner',
  40.7128,
  -74.0060,
  4.5,
  '2',
  '{american,diner}',
  null,
  true,
  'infinity'                               -- never expires; this is a fixture, not cached data
)
on conflict (id) do nothing;
