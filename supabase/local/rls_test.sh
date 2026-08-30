#!/usr/bin/env bash
# Proves the RLS policies in migrations/0006_rls.sql actually isolate accounts.
#
# Requires a local Postgres with the shim, migrations, and fixtures applied:
#   psql ... -f local/00_auth_shim.sql -f migrations/*.sql -f local/fixtures.sql
#
# Usage: PGHOST=/tmp PGPORT=5433 PGUSER=postgres PGDATABASE=spelling ./rls_test.sh

set -uo pipefail

A=aaaaaaaa-0000-4000-8000-000000000001   # account A
B=bbbbbbbb-0000-4000-8000-000000000002   # account B
PB=22222222-0000-4000-8000-000000000002  # profile owned by B

pass=0; fail=0

# Run SQL as the `authenticated` role impersonating account $1.
as_user() {
  psql -tAq -v ON_ERROR_STOP=0 <<EOF 2>&1
begin;
set local role authenticated;
set local request.jwt.claim.sub = '$1';
$2
rollback;
EOF
}

as_anon() {
  psql -tAq -v ON_ERROR_STOP=0 <<EOF 2>&1
begin;
set local role anon;
$1
rollback;
EOF
}

check_count() { # label, actual, expected
  if [ "$2" = "$3" ]; then printf '  PASS  %s\n' "$1"; pass=$((pass+1))
  else printf '  FAIL  %s (got "%s", expected "%s")\n' "$1" "$2" "$3"; fail=$((fail+1)); fi
}

check_denied() { # label, output
  if grep -qiE 'ERROR|denied|violates row-level' <<<"$2"; then
    printf '  PASS  %s (denied)\n' "$1"; pass=$((pass+1))
  else
    printf '  FAIL  %s — operation was ALLOWED\n' "$1"; fail=$((fail+1))
  fi
}

echo "Visibility"
check_count "A sees only its own account"   "$(as_user $A 'select count(*) from accounts;')" 1
check_count "A sees only its own profile"   "$(as_user $A 'select count(*) from profiles;')" 1
check_count "A sees only its own session"   "$(as_user $A 'select count(*) from sessions;')" 1
check_count "A sees only its own attempts"  "$(as_user $A 'select count(*) from attempts;')" 1
check_count "A cannot see B's profile by id" \
  "$(as_user $A "select count(*) from profiles where id = '$PB';")" 0
check_count "A sees its own list, not B's" \
  "$(as_user $A "select count(*) from word_lists where kind = 'user';")" 1
check_count "A can read shared content"     "$(as_user $A 'select count(*) from words;')" 1
check_count "A can read the band list"      "$(as_user $A "select count(*) from word_lists where kind='band';")" 6

echo "Cross-account writes"
check_denied "A cannot insert an attempt against B's profile" \
  "$(as_user $A "insert into attempts (id, session_id, profile_id, word_id, submitted, correct)
     values (gen_random_uuid(), 'bbbb2222-0000-4000-8000-000000000002', '$PB', 1, 'x', false);")"
check_denied "A cannot create a profile under B's account" \
  "$(as_user $A "insert into profiles (account_id, display_name, level)
     values ('$B', 'Impostor', 'grade_3_5');")"
check_denied "A cannot reassign its profile to B" \
  "$(as_user $A "update profiles set account_id = '$B';")"

echo "Append-only attempt log"
check_denied "A cannot update its own attempt" \
  "$(as_user $A "update attempts set correct = true;")"
check_denied "A cannot delete its own attempt" \
  "$(as_user $A "delete from attempts;")"

echo "Entitlement integrity"
check_denied "A cannot grant itself a paid entitlement" \
  "$(as_user $A "update accounts set entitlement = 'paid';")"

echo "Unmoderated content"
check_count "Unapproved generated sentences are invisible" \
  "$(as_user $A 'select count(*) from generated_sentences;')" 0

echo "Anonymous role"
check_denied "anon cannot read words"    "$(as_anon 'select count(*) from words;')"
check_denied "anon cannot read attempts" "$(as_anon 'select count(*) from attempts;')"

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
