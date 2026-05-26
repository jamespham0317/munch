-- 0001_enums.sql
-- Postgres enum types. Single source of truth alongside packages/core/src/types/enums.ts.
-- Mirrors docs/03-database-schema.md §2 exactly — keep the two in sync.
-- Migrations are immutable once applied (CLAUDE.md §6): never edit this file, add another.

create type session_status as enum (
  'lobby',
  'active',
  'awaiting_host_resolution',
  'matched',
  'resolved',
  'cancelled'
);

create type swipe_decision as enum ('like', 'pass');

create type price_level as enum ('1', '2', '3', '4'); -- $ to $$$$

create type member_role as enum ('host', 'member');
