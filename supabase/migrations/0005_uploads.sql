-- 0005 — Paid user word imports (v2 feature; schema landed early so the
-- enrichment pipeline has somewhere to write).

create table uploads (
  id              uuid primary key,
  account_id      uuid not null references accounts (id) on delete cascade,
  list_id         bigint references word_lists (id) on delete set null,
  source          text not null check (source in ('paste', 'csv', 'photo')),
  status          text not null default 'pending'
                    check (status in ('pending', 'enriching', 'moderated', 'ready', 'rejected')),
  rejected_reason text,
  raw_word_count  integer check (raw_word_count >= 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint rejected_has_reason check (status <> 'rejected' or rejected_reason is not null)
);

create index uploads_account_idx on uploads (account_id, created_at desc);

create trigger uploads_touch_updated_at
  before update on uploads
  for each row execute function touch_updated_at();
