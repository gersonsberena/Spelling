# Database

```
migrations/   the multi-user schema — apply these in order
local/        a local Postgres harness for verifying migrations and RLS
legacy/       the prototype's single-user schema, kept only so it still runs
```

## Applying to Supabase

Run `migrations/*.sql` in order in the SQL editor, or via the Supabase CLI. They
assume the `auth` schema and the `authenticated` / `anon` / `service_role` roles
that Supabase provides.

Do **not** also apply anything from `legacy/` — it defines conflicting tables
with `using (true)` policies.

| Migration | Contents |
| --- | --- |
| `0001_levels_and_accounts.sql` | Level bands, accounts, profiles, auth-user mirror trigger |
| `0002_content.sql` | Words, lists, audio assets, generated sentences |
| `0003_learning_state.sql` | Sessions, the append-only attempt log, FSRS review state |
| `0004_engagement.sql` | Streaks, Word of the Day |
| `0005_uploads.sql` | Paid user imports |
| `0006_rls.sql` | Row-level security — grants and policies |
| `0007_seed_levels.sql` | The six launch bands |

## Verifying locally

`local/verify.sh` rebuilds the schema from scratch in a plain Postgres and runs
the RLS suite. Run it before pushing any migration change.

```sh
# Start a throwaway Postgres (any local instance works)
initdb -D /tmp/pgdata -U postgres --auth=trust
pg_ctl -D /tmp/pgdata -o '-p 5433 -k /tmp' start

PGHOST=/tmp PGPORT=5433 PGUSER=postgres ./supabase/local/verify.sh
```

`local/00_auth_shim.sql` recreates just enough of Supabase's `auth` schema —
`auth.users`, `auth.uid()`, and the three roles — for the migrations to apply
and the policies to be exercised. It is a test double and must never be applied
to a real project.

`local/rls_test.sh` asserts the properties that matter:

- an account sees only its own account, profiles, sessions, and attempts
- it cannot read another account's rows, or write rows onto another's profile
- the attempt log is append-only — no update, no delete, even of one's own rows
- an account cannot grant itself a paid entitlement
- unapproved generated sentences are invisible
- the `anon` role, whose key ships publicly in the client, can read nothing
