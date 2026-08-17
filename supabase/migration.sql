-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query).

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
  last_seen_at timestamptz
);

alter table words enable row level security;
alter table word_stats enable row level security;

-- Single-user app, no auth: allow anonymous read on both tables.
create policy "public read words" on words
  for select using (true);

create policy "public read word_stats" on word_stats
  for select using (true);

-- Allow the app to update stats after each session (no insert/delete from the client).
create policy "public update word_stats" on word_stats
  for update using (true) with check (true);
