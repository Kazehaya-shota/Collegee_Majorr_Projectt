-- CourseMaster learning engine: generated lessons, quizzes, XP, levels, and streaks.
-- Run this file in the Supabase SQL Editor after 0001_course_master_schema.sql.

alter table public.course_modules add column if not exists lesson_content jsonb;
alter table public.course_modules add column if not exists quiz jsonb;
alter table public.course_modules add column if not exists lesson_generated_at timestamptz;

alter table public.module_progress add column if not exists xp_awarded integer not null default 0;
alter table public.module_progress add column if not exists quiz_score smallint;
alter table public.module_progress add column if not exists quiz_completed_at timestamptz;
alter table public.module_progress add column if not exists quiz_xp_awarded integer not null default 0;

alter table public.courses add column if not exists course_xp_awarded integer not null default 0;

create table if not exists public.learner_stats (
  user_id text primary key references public.profiles(clerk_user_id) on delete cascade,
  total_xp integer not null default 0 check (total_xp >= 0),
  level integer not null default 1 check (level > 0),
  current_streak integer not null default 0 check (current_streak >= 0),
  longest_streak integer not null default 0 check (longest_streak >= 0),
  last_activity_date date,
  updated_at timestamptz not null default now()
);

create table if not exists public.learning_activity (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.profiles(clerk_user_id) on delete cascade,
  activity_type text not null check (activity_type in ('lesson', 'quiz', 'course')),
  xp_earned integer not null check (xp_earned > 0),
  activity_date date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists learning_activity_user_date_idx on public.learning_activity (user_id, activity_date desc);

drop trigger if exists learner_stats_set_updated_at on public.learner_stats;
create trigger learner_stats_set_updated_at before update on public.learner_stats
for each row execute function public.set_updated_at();

alter table public.learner_stats enable row level security;
alter table public.learning_activity enable row level security;
