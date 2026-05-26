-- 0003_rls_policies.sql
-- Row-Level Security: ENABLED on every table, with the member-scoped policies summarized in
-- docs/03-database-schema.md. RLS on every table is a hard rule (CLAUDE.md §3).
--
-- Recursion guard: the "members of the same room" policies are self-referential on
-- room_members, which would cause infinite RLS recursion if expressed as a plain subquery.
-- The security-definer helpers below run with RLS bypassed, so policies can call them
-- safely. They are defined here (not in 0004) because the policies depend on them and
-- 0003 runs before 0004. auth.uid() is wrapped in a subselect per Supabase perf guidance.

-- Helper functions -----------------------------------------------------------

-- True if the current user has a member row in the given room.
create function public.auth_is_room_member(target_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from room_members rm
    where rm.room_id = target_room_id
      and rm.user_id = (select auth.uid())
  );
$$;

-- True if the current user is the host of the given room.
create function public.auth_is_room_host(target_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from room_members rm
    where rm.room_id = target_room_id
      and rm.user_id = (select auth.uid())
      and rm.role = 'host'
  );
$$;

-- True if the given member row belongs to the current user (for own-swipe scoping).
create function public.auth_owns_member(target_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from room_members rm
    where rm.id = target_member_id
      and rm.user_id = (select auth.uid())
  );
$$;

-- Enable RLS on every table -------------------------------------------------
alter table profiles       enable row level security;
alter table rooms          enable row level security;
alter table room_members   enable row level security;
alter table sessions       enable row level security;
alter table restaurants    enable row level security;
alter table cached_decks   enable row level security;
alter table swipes         enable row level security;
alter table matches        enable row level security;
alter table match_history  enable row level security;

-- profiles: a user sees/updates only their own profile (doc 03 §3.1) -----------
create policy profiles_select_own on profiles
  for select to authenticated
  using ((select auth.uid()) = id);

create policy profiles_update_own on profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- rooms: members may read; only the host may update settings (doc 03 §3.2).
-- Inserts and join-by-code go through security-definer RPCs (no direct insert policy).
create policy rooms_select_member on rooms
  for select to authenticated
  using (auth_is_room_member(id));

create policy rooms_update_host on rooms
  for update to authenticated
  using (auth_is_room_host(id))
  with check (auth_is_room_host(id));

-- room_members: read co-members of the same room; update only your own row (doc 03 §3.3).
-- Inserts go through the join RPC.
create policy room_members_select_same_room on room_members
  for select to authenticated
  using (auth_is_room_member(room_id));

create policy room_members_update_own on room_members
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- sessions: readable by members of the session's room (doc 03 §3.4).
-- Status transitions are performed by Edge Functions / host-only RPCs.
create policy sessions_select_member on sessions
  for select to authenticated
  using (auth_is_room_member(room_id));

-- restaurants -----------------------------------------------------------------
-- PHASE 0 SMOKE ARTIFACT: this permissive policy exists ONLY so the Phase 0 connectivity
-- test can read the seeded row from any authenticated (incl. anonymous) session. It must be
-- DROPPED/REPLACED in a Phase 1 migration with reads scoped to the requesting session's
-- deck membership. Do not build on this. (CLAUDE.md §3; phase-0-prompts.md Prompt 3.)
create policy restaurants_select_phase0_smoke on restaurants
  for select to authenticated
  using (true);

-- cached_decks: readable by members of the deck's session room (doc 03 §3.6).
create policy cached_decks_select_member on cached_decks
  for select to authenticated
  using (
    exists (
      select 1 from sessions s
      where s.id = cached_decks.session_id
        and auth_is_room_member(s.room_id)
    )
  );

-- swipes: a member may insert/select ONLY their own swipes; never another member's
-- (doc 03 §3.7, CLAUDE.md §3). The authoritative match check reads more broadly via a
-- security-definer function (0004), not via these policies.
create policy swipes_select_own on swipes
  for select to authenticated
  using (auth_owns_member(member_id));

create policy swipes_insert_own on swipes
  for insert to authenticated
  with check (auth_owns_member(member_id));

-- matches: readable by members of the session's room (doc 03 §3.8). Writes via Edge Function.
create policy matches_select_member on matches
  for select to authenticated
  using (
    exists (
      select 1 from sessions s
      where s.id = matches.session_id
        and auth_is_room_member(s.room_id)
    )
  );

-- match_history: a user sees only their own history rows (doc 03 §3.9). Writes via Edge
-- Function on match. Guests have no history.
create policy match_history_select_own on match_history
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Grant the Phase 0 smoke read explicitly so it does not depend on default privileges.
grant select on restaurants to anon, authenticated;
