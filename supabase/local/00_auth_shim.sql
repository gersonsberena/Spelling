-- LOCAL TESTING ONLY. Do not apply this to a Supabase project.
--
-- Supabase provides the `auth` schema, `auth.users`, `auth.uid()`, and the
-- `authenticated` / `anon` roles. This shim recreates just enough of that
-- surface so the migrations in ../migrations can be applied and their RLS
-- policies exercised against a plain Postgres instance.

create schema if not exists auth;

create table if not exists auth.users (
  id    uuid primary key default gen_random_uuid(),
  email text
);

-- Supabase derives auth.uid() from the request JWT. Locally we drive it from a
-- session GUC so a test can "become" a user with `set local request.jwt.claim.sub`.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $$;

grant usage on schema public to authenticated, anon, service_role;
grant usage on schema auth to authenticated, anon, service_role;
