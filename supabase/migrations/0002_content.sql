-- 0002 — Word bank, lists, and pre-rendered audio.
--
-- Content is world-readable and service-role-writable. No client-facing insert,
-- update, or delete policy is ever defined on these tables (see 0006).

create table words (
  id                        bigint generated always as identity primary key,
  word                      text not null unique check (length(trim(word)) > 0),
  part_of_speech            text,
  definition                text,
  definition_reading_level  integer check (definition_reading_level between 1 and 16),
  sample_sentence           text,
  -- Character offsets of the target word inside sample_sentence, so masking the
  -- answer when the sentence is *displayed* is mechanical. A naive string search
  -- breaks on inflected forms ("running" inside a sentence about "run").
  sentence_mask_start       integer,
  sentence_mask_end         integer,
  ipa                       text,
  -- Text actually sent to the TTS engine when plain spelling mispronounces.
  -- e.g. 'epitome' -> 'eh-PIT-oh-mee'. See docs/05-text-to-speech.md.
  tts_override_text         text,
  language_of_origin        text,
  -- Non-null means audio alone cannot identify this word (their/there/they're).
  -- The client MUST show the definition before enabling the answer field.
  homophone_group           text,
  syllables                 integer check (syllables > 0),
  frequency_rank            integer,
  error_patterns            text[] not null default '{}',
  age_gated                 boolean not null default false,
  source                    text,
  license                   text,
  pronunciation_verified_at timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  constraint sentence_mask_coherent check (
    (sentence_mask_start is null and sentence_mask_end is null)
    or (sample_sentence is not null
        and sentence_mask_start >= 0
        and sentence_mask_end > sentence_mask_start
        and sentence_mask_end <= length(sample_sentence))
  )
);

comment on column words.pronunciation_verified_at is
  'Set only by a human listening to the synthesized clip. Unverified words must not be served to paid users — a mispronunciation produces a wrong answer the learner could not have avoided.';

create index words_homophone_idx on words (homophone_group) where homophone_group is not null;
create index words_error_patterns_idx on words using gin (error_patterns);
create index words_frequency_idx on words (frequency_rank);
create index words_unverified_idx on words (id) where pronunciation_verified_at is null;

-- Bands and curated/user lists are the same shape with a different `kind`.
create table word_lists (
  id                bigint generated always as identity primary key,
  slug              text not null unique,
  title             text not null,
  kind              text not null check (kind in ('band', 'curated', 'user')),
  level             text references levels (slug),
  owner_account_id  uuid references accounts (id) on delete cascade,
  created_at        timestamptz not null default now(),

  -- A band is public and tied to a level; a user list is private and owned.
  constraint list_ownership_coherent check (
    (kind = 'user'  and owner_account_id is not null)
    or (kind <> 'user' and owner_account_id is null)
  ),
  constraint band_has_level check (kind <> 'band' or level is not null)
);

create index word_lists_owner_idx on word_lists (owner_account_id) where owner_account_id is not null;

create table word_list_items (
  list_id   bigint not null references word_lists (id) on delete cascade,
  word_id   bigint not null references words (id) on delete cascade,
  position  integer,
  primary key (list_id, word_id)
);

create index word_list_items_word_idx on word_list_items (word_id);

-- Pre-rendered audio. Content-addressed: one row per (voice, exact text), so
-- editing a definition yields a new asset instead of silently serving stale audio.
create table audio_assets (
  id            bigint generated always as identity primary key,
  word_id       bigint references words (id) on delete cascade,
  kind          text not null check (kind in ('word', 'word_alt', 'definition', 'sentence')),
  voice_id      text not null,
  text_hash     text not null check (text_hash ~ '^[0-9a-f]{64}$'),
  storage_path  text not null,
  duration_ms   integer,
  bytes         integer,
  created_at    timestamptz not null default now(),
  unique (voice_id, text_hash)
);

create index audio_assets_lookup_idx on audio_assets (word_id, kind, voice_id);

-- Cached LLM sentences. Generated once per (word, level) and reused for every
-- user who ever sees that word — this is what keeps AI cost bounded.
create table generated_sentences (
  id            bigint generated always as identity primary key,
  word_id       bigint not null references words (id) on delete cascade,
  level         text not null references levels (slug),
  sentence      text not null,
  model         text not null,
  moderated_at  timestamptz,
  approved      boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (word_id, level, sentence)
);

create index generated_sentences_approved_idx on generated_sentences (word_id, level)
  where approved;

create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger words_touch_updated_at
  before update on words
  for each row execute function touch_updated_at();
