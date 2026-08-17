-- Run in the Supabase SQL editor. Safe to run even if some pieces already exist.

-- Tracks whether the most recent attempt at a word was right or wrong, so
-- "retest missed words" can pull exactly the words currently being missed
-- (a word drops off the list as soon as it's answered correctly again).
alter table word_stats add column if not exists last_result text;

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

alter table sessions enable row level security;
alter table session_words enable row level security;

-- Single-user app, no auth: allow the client to read and record sessions.
create policy "public read sessions" on sessions
  for select using (true);

create policy "public insert sessions" on sessions
  for insert with check (true);

create policy "public read session_words" on session_words
  for select using (true);

create policy "public insert session_words" on session_words
  for insert with check (true);
