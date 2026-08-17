-- Only needed if you already ran the original supabase/migration.sql before
-- grade_level/source were added to it. Safe to run even if the columns
-- already exist. Run in the Supabase SQL editor.

alter table words add column if not exists grade_level integer;
alter table words add column if not exists source text;
