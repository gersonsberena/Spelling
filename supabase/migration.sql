-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query).
-- For a database that already ran an earlier version of this file, use the
-- numbered incremental migrations in this folder instead (002, 003, ...).

create table if not exists words (
  id bigint generated always as identity primary key,
  word text not null unique,
  part_of_speech text,
  definition text,
  sample_sentence text,
  grade_level integer,
  source text
);

create table if not exists word_stats (
  word_id bigint primary key references words (id) on delete cascade,
  times_seen integer not null default 0,
  times_missed integer not null default 0,
  last_seen_at timestamptz,
  last_result text
);

create table if not exists sessions (
  id bigint generated always as identity primary key,
  started_at timestamptz not null,
  finished_at timestamptz not null default now(),
  mode text not null default 'practice', -- 'practice' | 'retest'
  word_count integer not null,
  correct_count integer not null
);

create table if not exists session_words (
  id bigint generated always as identity primary key,
  session_id bigint not null references sessions (id) on delete cascade,
  word_id bigint not null references words (id) on delete cascade,
  correct boolean not null
);

alter table words enable row level security;
alter table word_stats enable row level security;
alter table sessions enable row level security;
alter table session_words enable row level security;

-- Single-user app, no auth: allow anonymous read on all tables.
create policy "public read words" on words
  for select using (true);

create policy "public read word_stats" on word_stats
  for select using (true);

create policy "public read sessions" on sessions
  for select using (true);

create policy "public read session_words" on session_words
  for select using (true);

-- Allow the app to update stats after each session (no delete from the client).
create policy "public update word_stats" on word_stats
  for update using (true) with check (true);

-- Allow the app to record a session's results as it finishes.
create policy "public insert sessions" on sessions
  for insert with check (true);

create policy "public insert session_words" on session_words
  for insert with check (true);
