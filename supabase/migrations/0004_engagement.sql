-- 0004 — Streaks and Word of the Day.

create table streaks (
  profile_id        uuid primary key references profiles (id) on delete cascade,
  current_days      integer not null default 0 check (current_days >= 0),
  longest_days      integer not null default 0 check (longest_days >= 0),
  last_active_on    date,
  freezes_available integer not null default 2 check (freezes_available between 0 and 5),
  freezes_used_on   date[] not null default '{}',

  constraint longest_at_least_current check (longest_days >= current_days)
);

-- Pre-computed a week ahead so the home screen widget renders correctly with no
-- network. One word per level per day. See docs/07-gamification.md.
create table word_of_the_day (
  on_date  date not null,
  level    text not null references levels (slug),
  word_id  bigint not null references words (id),
  primary key (on_date, level)
);

create index wotd_upcoming_idx on word_of_the_day (level, on_date desc);
