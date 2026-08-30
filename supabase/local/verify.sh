#!/usr/bin/env bash
# Rebuilds the schema from scratch in a local Postgres and runs the RLS tests.
# This is the check to run before pushing a migration change.
#
#   PGHOST=/tmp PGPORT=5433 PGUSER=postgres ./supabase/local/verify.sh
#
# It does NOT talk to Supabase. The auth shim stands in for the auth schema that
# a real Supabase project provides.

set -euo pipefail
cd "$(dirname "$0")"

DB="${VERIFY_DB:-spelling_verify}"
export PGDATABASE=postgres

echo "==> Recreating database $DB"
psql -q -c "drop database if exists $DB;"
psql -q -c "create database $DB;"

export PGDATABASE="$DB"

echo "==> Applying auth shim"
psql -q -v ON_ERROR_STOP=1 -f 00_auth_shim.sql

echo "==> Applying migrations"
for f in ../migrations/*.sql; do
  printf '    %s\n' "$(basename "$f")"
  psql -q -v ON_ERROR_STOP=1 -f "$f"
done

echo "==> Loading fixtures"
psql -q -v ON_ERROR_STOP=1 -f fixtures.sql 2>/dev/null

echo "==> Checking every public table has RLS enabled"
psql -q -v ON_ERROR_STOP=1 <<'EOF'
do $$
declare unprotected text;
begin
  select string_agg(c.relname, ', ')
    into unprotected
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;

  if unprotected is not null then
    raise exception 'tables without RLS: %', unprotected;
  end if;
  raise notice 'all public tables have RLS enabled';
end $$;
EOF

echo "==> Running RLS tests"
./rls_test.sh
