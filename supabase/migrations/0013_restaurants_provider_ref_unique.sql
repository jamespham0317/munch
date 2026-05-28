-- 0013_restaurants_provider_ref_unique.sql
-- Phase 2 fix: the (provider, provider_ref) index on `restaurants` must be UNIQUE.
-- start_session (Edge Function, Prompt 3) upserts restaurants with
-- `on conflict (provider, provider_ref)` to dedupe a place across sessions — a restaurant
-- is identified by its provider + provider place id, so a duplicate pair is a data bug.
-- 0002 created this as a PLAIN index, so the upsert raised 42P10 ("no unique or exclusion
-- constraint matching the ON CONFLICT specification") and start_session could never cache a
-- deck. The function comment and docs/03 §3.5 already described it as unique; this migration
-- makes reality match. Migrations are immutable once applied (CLAUDE.md §6): new file, never
-- edit 0002.
drop index if exists idx_restaurants_provider_ref;
create unique index idx_restaurants_provider_ref on restaurants (provider, provider_ref);
