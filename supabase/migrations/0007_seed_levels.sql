-- 0007 — The six launch bands (docs/12-open-questions.md Q4: six-band scope).
--
-- `ordinal` drives progression when a learner exhausts a band. Reading levels
-- bound how a definition may be rewritten for that audience.

insert into levels (slug, title, ordinal, audience, min_reading_level, max_reading_level) values
  ('grade_1_2',          'Grades 1–2',          10, 'child',  1,  2),
  ('grade_3_5',          'Grades 3–5',          20, 'child',  2,  5),
  ('grade_6_8',          'Grades 6–8',          30, 'child',  4,  8),
  ('high_school_sat',    'High School & SAT',   40, 'teen',   6, 11),
  ('adult_general',      'Adult',               50, 'adult',  6, 12),
  ('adult_professional', 'Adult Professional',  60, 'adult',  8, 14)
on conflict (slug) do nothing;

-- Every band gets a matching list; word membership is many-to-many, so a word
-- can sit in both grade_6_8 and high_school_sat without duplication.
insert into word_lists (slug, title, kind, level)
select slug, title, 'band', slug from levels
on conflict (slug) do nothing;
