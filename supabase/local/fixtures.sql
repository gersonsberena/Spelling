-- LOCAL TESTING ONLY. Two unrelated accounts, each with a profile, a session,
-- an attempt, and a private word list. Used by rls_test.sh to prove that neither
-- can observe or touch the other.

-- NOTE: `truncate ... cascade` truncates whole referencing tables, so this also
-- empties word_lists (which references accounts via owner_account_id). That is a
-- TRUNCATE artifact, not delete behavior — deleting an account cascades only to
-- rows whose owner_account_id matches, leaving the NULL-owner band rows intact.
-- The band seed is therefore replayed below.
truncate auth.users cascade;
truncate words cascade;

insert into word_lists (slug, title, kind, level)
select slug, title, 'band', slug from levels
on conflict (slug) do nothing;

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'a@example.test'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'b@example.test');

insert into profiles (id, account_id, display_name, level) values
  ('11111111-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'Learner A', 'grade_3_5'),
  ('22222222-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000002', 'Learner B', 'grade_3_5');

insert into words (id, word, definition, part_of_speech)
  overriding system value
  values (1, 'necessary', 'Needed in order to achieve a result.', 'adjective');

insert into sessions (id, profile_id, mode, started_at) values
  ('aaaa1111-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000001', 'practice', now()),
  ('bbbb2222-0000-4000-8000-000000000002', '22222222-0000-4000-8000-000000000002', 'practice', now());

insert into attempts (id, session_id, profile_id, word_id, submitted, correct) values
  ('aaaa3333-0000-4000-8000-000000000001', 'aaaa1111-0000-4000-8000-000000000001',
   '11111111-0000-4000-8000-000000000001', 1, 'necesary', false),
  ('bbbb4444-0000-4000-8000-000000000002', 'bbbb2222-0000-4000-8000-000000000002',
   '22222222-0000-4000-8000-000000000002', 1, 'necessary', true);

insert into word_lists (slug, title, kind, owner_account_id) values
  ('a-private-list', 'A private list', 'user', 'aaaaaaaa-0000-4000-8000-000000000001'),
  ('b-private-list', 'B private list', 'user', 'bbbbbbbb-0000-4000-8000-000000000002');
