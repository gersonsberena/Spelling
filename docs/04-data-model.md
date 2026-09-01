# 04 — Data Model

## What is wrong with the prototype schema

`supabase/migration.sql` is a correct single-user schema and an unsafe
multi-user one. Four problems, all blocking:

1. **No user or profile concept.** `word_stats` is global — one row per word for
   the entire installation. Two users would overwrite each other's progress.
2. **Every RLS policy is `using (true)`.** Anyone holding the anon key (which
   ships in `config.js` and is therefore public) can read and write all sessions
   and all stats. With real users this is a data breach, not a rough edge.
3. **`grade_level integer` cannot express the product.** There is no integer for
   "SAT", "adult professional", or "ESL foundation", and a word legitimately
   belongs to several bands at once.
4. **No audio, homophone, or pronunciation fields**, so the TTS pipeline and the
   homophone rule have nowhere to live.

This is a rebuild of the schema, not a patch. The word content is worth
migrating; the stats are not.

## Target schema

```sql
-- ─────────────────────────── Accounts ───────────────────────────

-- One row per Supabase auth user. This is the *account holder* — an adult.
create table accounts (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text,
  entitlement   text not null default 'free',   -- 'free' | 'paid' | 'classroom'
  entitlement_expires_at timestamptz,
  rc_customer_id text,                          -- RevenueCat
  created_at    timestamptz not null default now()
);

-- Learners. A child never has an auth account of their own (see doc 10).
create table profiles (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references accounts (id) on delete cascade,
  display_name  text not null,
  level         text not null,                  -- see word_lists.level enum values
  birth_year    integer,                        -- year only; never a full DOB
  is_child      boolean not null default true,
  daily_goal    integer not null default 10,
  voice_id      text,
  created_at    timestamptz not null default now()
);

create index on profiles (account_id);

-- ─────────────────────────── Content ────────────────────────────

create table words (
  id            bigint generated always as identity primary key,
  word          text not null unique,
  part_of_speech text,
  definition    text,
  definition_reading_level integer,             -- approx. grade level of the text
  sample_sentence text,
  sentence_mask_start integer,                  -- char offsets of the target word
  sentence_mask_end   integer,
  ipa           text,
  tts_override_text text,                       -- forces correct synthesis
  language_of_origin text,
  homophone_group text,                         -- non-null => audio is ambiguous
  syllables     integer,
  frequency_rank integer,
  error_patterns text[] not null default '{}',  -- see doc 06
  age_gated     boolean not null default false,
  source        text,
  license       text,
  pronunciation_verified_at timestamptz,
  created_at    timestamptz not null default now()
);

create index on words (homophone_group) where homophone_group is not null;
create index on words using gin (error_patterns);

-- Bands and curated lists are the same thing with a different `kind`.
create table word_lists (
  id            bigint generated always as identity primary key,
  slug          text not null unique,           -- 'grade_3', 'sat_act', 'adult_professional'
  title         text not null,
  kind          text not null,                  -- 'band' | 'curated' | 'user'
  level         text,                           -- band ordering key, null for user lists
  owner_account_id uuid references accounts (id) on delete cascade,  -- user lists only
  created_at    timestamptz not null default now()
);

create table word_list_items (
  list_id       bigint not null references word_lists (id) on delete cascade,
  word_id       bigint not null references words (id) on delete cascade,
  position      integer,
  primary key (list_id, word_id)
);

-- Pre-rendered audio. One row per (text, voice) pair; see doc 05.
create table audio_assets (
  id            bigint generated always as identity primary key,
  word_id       bigint references words (id) on delete cascade,
  kind          text not null,                  -- 'word' | 'definition' | 'sentence'
  voice_id      text not null,
  text_hash     text not null,                  -- sha256 of the exact synthesized text
  storage_path  text not null,
  duration_ms   integer,
  bytes         integer,
  created_at    timestamptz not null default now(),
  unique (voice_id, text_hash)
);

create index on audio_assets (word_id, kind, voice_id);

-- ─────────────────────── Learning state ─────────────────────────

create table sessions (
  id            uuid primary key,               -- client-generated, idempotent
  profile_id    uuid not null references profiles (id) on delete cascade,
  mode          text not null,                  -- 'practice' | 'retest' | 'drill' | 'bee' | 'wotd'
  list_id       bigint references word_lists (id) on delete set null,
  started_at    timestamptz not null,
  finished_at   timestamptz,
  word_count    integer not null default 0,
  correct_count integer not null default 0
);

create index on sessions (profile_id, started_at desc);

create table attempts (
  id            uuid primary key,               -- client-generated, idempotent
  session_id    uuid not null references sessions (id) on delete cascade,
  profile_id    uuid not null references profiles (id) on delete cascade,
  word_id       bigint not null references words (id) on delete cascade,
  submitted     text not null,                  -- exactly what the learner typed
  correct       boolean not null,
  edit_distance integer,
  error_patterns text[] not null default '{}',  -- classified at attempt time, doc 06
  hints_used    integer not null default 0,
  replays       integer not null default 0,
  latency_ms    integer,
  input_mode    text,                           -- 'keyboard' | 'tiles' | 'handwriting' | 'voice'
  created_at    timestamptz not null default now()
);

create index on attempts (profile_id, word_id, created_at desc);
create index on attempts (profile_id, created_at desc);

-- One row per (profile, word). The scheduler's working set. See doc 06.
create table review_state (
  profile_id    uuid not null references profiles (id) on delete cascade,
  word_id       bigint not null references words (id) on delete cascade,
  stability     real not null default 0,        -- FSRS
  difficulty    real not null default 5,        -- FSRS
  due_at        timestamptz not null,
  interval_days real not null default 0,
  reps          integer not null default 0,
  lapses        integer not null default 0,
  mastery       text not null default 'new',    -- 'new'|'learning'|'review'|'mastered'|'lapsed'
  last_result   boolean,
  last_seen_at  timestamptz,
  primary key (profile_id, word_id)
);

create index on review_state (profile_id, due_at) where mastery <> 'mastered';

-- ─────────────────────── Engagement ─────────────────────────────

create table streaks (
  profile_id    uuid primary key references profiles (id) on delete cascade,
  current_days  integer not null default 0,
  longest_days  integer not null default 0,
  last_active_on date,
  freezes_available integer not null default 2,
  freezes_used_on date[]
);

create table word_of_the_day (
  on_date       date not null,
  level         text not null,
  word_id       bigint not null references words (id),
  primary key (on_date, level)
);

-- ─────────────────────── User uploads ───────────────────────────

create table uploads (
  id            uuid primary key,
  account_id    uuid not null references accounts (id) on delete cascade,
  list_id       bigint references word_lists (id) on delete set null,
  source        text not null,                  -- 'paste' | 'csv' | 'photo'
  status        text not null default 'pending',-- pending|enriching|moderated|ready|rejected
  rejected_reason text,
  raw_word_count integer,
  created_at    timestamptz not null default now()
);
```

## Row-level security

The rule: **content is world-readable, everything else is scoped to the
account.** No policy in this schema may be `using (true)` on a table containing
user data.

```sql
alter table accounts       enable row level security;
alter table profiles       enable row level security;
alter table sessions       enable row level security;
alter table attempts       enable row level security;
alter table review_state   enable row level security;
alter table streaks        enable row level security;
alter table uploads        enable row level security;
alter table words          enable row level security;
alter table word_lists     enable row level security;
alter table word_list_items enable row level security;
alter table audio_assets   enable row level security;

-- Content: readable by any authenticated user, writable only by the service role
-- (which bypasses RLS). No insert/update/delete policies are defined at all.
create policy "read words" on words
  for select to authenticated using (true);
create policy "read audio" on audio_assets
  for select to authenticated using (true);
create policy "read list items" on word_list_items
  for select to authenticated using (true);

-- Band lists are public; user lists belong to their owner.
create policy "read lists" on word_lists
  for select to authenticated
  using (kind <> 'user' or owner_account_id = auth.uid());

-- Account holders see only themselves.
create policy "own account" on accounts
  for select to authenticated using (id = auth.uid());

-- Profiles belong to the account.
create policy "own profiles" on profiles
  for all to authenticated
  using (account_id = auth.uid())
  with check (account_id = auth.uid());

-- Helper: does this profile belong to the calling account?
create or replace function owns_profile(p uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from profiles
    where id = p and account_id = auth.uid()
  );
$$;

create policy "own sessions" on sessions
  for all to authenticated
  using (owns_profile(profile_id)) with check (owns_profile(profile_id));

create policy "own attempts" on attempts
  for all to authenticated
  using (owns_profile(profile_id)) with check (owns_profile(profile_id));

create policy "own review state" on review_state
  for all to authenticated
  using (owns_profile(profile_id)) with check (owns_profile(profile_id));

create policy "own streaks" on streaks
  for all to authenticated
  using (owns_profile(profile_id)) with check (owns_profile(profile_id));

create policy "own uploads" on uploads
  for all to authenticated
  using (account_id = auth.uid()) with check (account_id = auth.uid());
```

Note that `entitlement` lives on a table the client can read but not write, and
is written only by the RevenueCat webhook running with the service role. Any
Edge Function that spends money reads it server-side; a client claim of "I am
paid" is never trusted.

## Migration from the prototype

1. `words` carries forward. Add the new columns, backfill `ipa`,
   `homophone_group`, `error_patterns`, and `syllables` from the enrichment
   pipeline, and convert `grade_level` into `word_lists` / `word_list_items`
   rows.
2. `word_stats`, `sessions`, `session_words` are **dropped**. They are global
   and unattributable; there is no correct account to assign them to.
3. `scripts/import-words.mjs` needs updating for the new columns and for writing
   list membership instead of `grade_level`. Its service-role pattern is right
   and should be kept.
4. Delete every `using (true)` policy before the first real user exists.
