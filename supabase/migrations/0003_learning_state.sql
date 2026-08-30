-- 0003 — Sessions, the attempt log, and FSRS review state.
--
-- Sessions and attempts carry client-generated UUIDs so the offline sync push is
-- idempotent: a retry after a partial failure re-sends the same ids and conflicts
-- away harmlessly. See docs/03-architecture.md.

create table sessions (
  id            uuid primary key,
  profile_id    uuid not null references profiles (id) on delete cascade,
  mode          text not null check (mode in ('practice', 'retest', 'drill', 'bee', 'wotd', 'placement')),
  list_id       bigint references word_lists (id) on delete set null,
  started_at    timestamptz not null,
  finished_at   timestamptz,
  word_count    integer not null default 0 check (word_count >= 0),
  correct_count integer not null default 0 check (correct_count >= 0),

  constraint correct_within_total check (correct_count <= word_count),
  constraint finished_after_started check (finished_at is null or finished_at >= started_at)
);

create index sessions_profile_idx on sessions (profile_id, started_at desc);

-- Append-only. The RLS policies in 0006 grant insert and select but deliberately
-- no update or delete: a learner must not be able to rewrite their own history,
-- and every downstream statistic derives from this table.
create table attempts (
  id             uuid primary key,
  session_id     uuid not null references sessions (id) on delete cascade,
  profile_id     uuid not null references profiles (id) on delete cascade,
  word_id        bigint not null references words (id) on delete cascade,
  submitted      text not null,
  correct        boolean not null,
  edit_distance  integer check (edit_distance >= 0),
  error_patterns text[] not null default '{}',
  hints_used     integer not null default 0 check (hints_used >= 0),
  replays        integer not null default 0 check (replays >= 0),
  latency_ms     integer check (latency_ms >= 0),
  input_mode     text check (input_mode in ('keyboard', 'tiles', 'handwriting', 'voice')),
  created_at     timestamptz not null default now()
);

comment on column attempts.error_patterns is
  'How this learner tripped on this attempt. Distinct from words.error_patterns, which is what a word exercises. Reports aggregate this column; drills select on that one.';

create index attempts_profile_word_idx on attempts (profile_id, word_id, created_at desc);
create index attempts_profile_recent_idx on attempts (profile_id, created_at desc);
create index attempts_session_idx on attempts (session_id);
create index attempts_patterns_idx on attempts using gin (error_patterns);

-- One row per (profile, word): the scheduler's working set.
create table review_state (
  profile_id    uuid not null references profiles (id) on delete cascade,
  word_id       bigint not null references words (id) on delete cascade,
  stability     real not null default 0 check (stability >= 0),
  difficulty    real not null default 5 check (difficulty between 1 and 10),
  due_at        timestamptz not null default now(),
  interval_days real not null default 0 check (interval_days >= 0),
  reps          integer not null default 0 check (reps >= 0),
  lapses        integer not null default 0 check (lapses >= 0),
  mastery       text not null default 'new'
                  check (mastery in ('new', 'learning', 'review', 'mastered', 'lapsed')),
  last_result   boolean,
  last_seen_at  timestamptz,
  updated_at    timestamptz not null default now(),
  primary key (profile_id, word_id)
);

-- The scheduler's hot query: "what is due for this profile?" Mastered words are
-- excluded from the index entirely since they are not scheduled.
create index review_state_due_idx on review_state (profile_id, due_at)
  where mastery <> 'mastered';

create index review_state_mastery_idx on review_state (profile_id, mastery);

create trigger review_state_touch_updated_at
  before update on review_state
  for each row execute function touch_updated_at();
