-- 0006 — Row-level security.
--
-- The rule: content is world-readable to signed-in users; everything else is
-- scoped to the owning account. No policy in this file is `using (true)` on a
-- table containing user data. The prototype's schema (supabase/legacy/) granted
-- exactly that, which with real users is a data breach rather than a rough edge.
--
-- Two layers are used together on purpose:
--   GRANT  decides whether an operation is permitted at all
--   POLICY decides which rows it may touch
-- Append-only tables are enforced by withholding the UPDATE/DELETE grant *and*
-- defining no such policy.

alter table levels              enable row level security;
alter table accounts            enable row level security;
alter table profiles            enable row level security;
alter table words               enable row level security;
alter table word_lists          enable row level security;
alter table word_list_items     enable row level security;
alter table audio_assets        enable row level security;
alter table generated_sentences enable row level security;
alter table sessions            enable row level security;
alter table attempts            enable row level security;
alter table review_state        enable row level security;
alter table streaks             enable row level security;
alter table word_of_the_day     enable row level security;
alter table uploads             enable row level security;

-- ──────────────────────── Ownership helper ─────────────────────
-- SECURITY DEFINER so it can see profiles without recursing through the
-- profiles policy. `set search_path` is mandatory here: without it a caller
-- could shadow `public.profiles` with a temp table and defeat the check.

create or replace function owns_profile(p uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = p and account_id = auth.uid()
  );
$$;

revoke all on function owns_profile(uuid) from public;
grant execute on function owns_profile(uuid) to authenticated;

-- ──────────────────────────── Content ──────────────────────────
-- Read-only to clients. Writes happen exclusively through the service role,
-- which bypasses RLS — so no insert/update/delete policy is defined at all.

grant select on levels, words, word_list_items, audio_assets, word_of_the_day to authenticated;
grant select on generated_sentences to authenticated;
grant select on word_lists to authenticated;

create policy "read levels" on levels
  for select to authenticated using (true);

create policy "read words" on words
  for select to authenticated using (true);

create policy "read list items" on word_list_items
  for select to authenticated using (true);

create policy "read audio" on audio_assets
  for select to authenticated using (true);

create policy "read word of the day" on word_of_the_day
  for select to authenticated using (true);

-- Only sentences that passed moderation are ever visible to a client.
create policy "read approved sentences" on generated_sentences
  for select to authenticated using (approved);

-- Bands and curated lists are public; a user list belongs to its owner alone.
create policy "read lists" on word_lists
  for select to authenticated
  using (kind <> 'user' or owner_account_id = auth.uid());

-- ──────────────────────────── Accounts ─────────────────────────
-- Select only. Rows are created by the on_auth_user_created trigger, and
-- `entitlement` is written solely by the RevenueCat webhook via the service
-- role. Granting the client any write here would let it grant itself paid access.

grant select on accounts to authenticated;

create policy "read own account" on accounts
  for select to authenticated using (id = auth.uid());

-- ──────────────────────────── Profiles ─────────────────────────

grant select, insert, update, delete on profiles to authenticated;

create policy "own profiles" on profiles
  for all to authenticated
  using (account_id = auth.uid())
  with check (account_id = auth.uid());

-- ──────────────────────── Learning state ───────────────────────

grant select, insert, update on sessions to authenticated;

create policy "read own sessions" on sessions
  for select to authenticated using (owns_profile(profile_id));

create policy "insert own sessions" on sessions
  for insert to authenticated with check (owns_profile(profile_id));

-- Update exists only so a session can be closed out (finished_at, counts).
create policy "update own sessions" on sessions
  for update to authenticated
  using (owns_profile(profile_id))
  with check (owns_profile(profile_id));

-- Attempts are append-only: no update or delete grant, no such policy.
grant select, insert on attempts to authenticated;

create policy "read own attempts" on attempts
  for select to authenticated using (owns_profile(profile_id));

create policy "insert own attempts" on attempts
  for insert to authenticated with check (owns_profile(profile_id));

grant select, insert, update, delete on review_state to authenticated;

create policy "own review state" on review_state
  for all to authenticated
  using (owns_profile(profile_id))
  with check (owns_profile(profile_id));

grant select, insert, update on streaks to authenticated;

create policy "own streaks" on streaks
  for all to authenticated
  using (owns_profile(profile_id))
  with check (owns_profile(profile_id));

-- ──────────────────────────── Uploads ──────────────────────────

grant select, insert, update on uploads to authenticated;

create policy "own uploads" on uploads
  for all to authenticated
  using (account_id = auth.uid())
  with check (account_id = auth.uid());

-- ──────────────────────── Anonymous role ───────────────────────
-- The anon key ships publicly in the client. It gets nothing.

revoke all on all tables in schema public from anon;
