-- 0001 — Levels, accounts, profiles.
--
-- Replaces the prototype's single-user model (see supabase/legacy/). Adults hold
-- accounts; learners are profiles beneath them. No child ever authenticates.
-- Rationale in docs/10-compliance-privacy.md.

create extension if not exists pgcrypto;

-- ─────────────────────────── Levels ───────────────────────────
-- docs/04 modelled `level` as bare text. A lookup table is used instead so the
-- value is referentially enforced and so bands have an explicit order, which
-- "promote to the next band" and difficulty scoring both need.

create table levels (
  slug        text primary key,
  title       text not null,
  ordinal     integer not null unique,
  audience    text not null check (audience in ('child', 'teen', 'adult')),
  min_reading_level integer,
  max_reading_level integer
);

comment on table levels is
  'Ordered word bands. `ordinal` defines progression; `audience` drives which UI shell and reward style a profile gets.';

-- ─────────────────────────── Accounts ──────────────────────────

create table accounts (
  id                      uuid primary key references auth.users (id) on delete cascade,
  email                   text,
  entitlement             text not null default 'free'
                            check (entitlement in ('free', 'paid', 'classroom')),
  entitlement_expires_at  timestamptz,
  rc_customer_id          text,
  created_at              timestamptz not null default now()
);

comment on column accounts.entitlement is
  'Written only by the RevenueCat webhook via the service role. Clients may read it but never write it; money-spending Edge Functions read it server-side.';

-- Supabase creates auth.users rows outside our control, so mirror them into
-- accounts automatically. Without this an account row would have to be inserted
-- by the client, which would mean granting an insert policy on a table holding
-- the entitlement column.
create or replace function handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.accounts (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();

-- ─────────────────────────── Profiles ──────────────────────────

create table profiles (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references accounts (id) on delete cascade,
  display_name  text not null check (length(trim(display_name)) between 1 and 40),
  level         text not null references levels (slug),
  birth_year    integer check (birth_year between 1900 and 2100),
  is_child      boolean not null default true,
  daily_goal    integer not null default 10 check (daily_goal between 5 and 50),
  voice_id      text,
  created_at    timestamptz not null default now()
);

comment on column profiles.birth_year is
  'Year only, never a full date of birth — data minimization under COPPA. Supplied by the account holder, not by a child.';

create index profiles_account_idx on profiles (account_id);
