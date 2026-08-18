-- Varen certificate eligibility.
-- Existing courses intentionally remain unclassified and therefore cannot receive
-- a certificate. New courses are labelled by the feature that created them.

alter table public.courses add column if not exists creation_origin text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'courses_creation_origin_check'
  ) then
    alter table public.courses
      add constraint courses_creation_origin_check
      check (creation_origin is null or creation_origin in ('ai_course_generator', 'content_ingestion', 'youtube_to_course'));
  end if;
end $$;

create index if not exists courses_owner_origin_idx
  on public.courses (owner_id, creation_origin);
