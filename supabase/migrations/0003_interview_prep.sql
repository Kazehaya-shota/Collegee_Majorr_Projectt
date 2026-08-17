-- Varen interview-prep sessions and interview XP.
-- Run this file in Supabase SQL Editor after the previous two migrations.

create table if not exists public.interview_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.profiles(clerk_user_id) on delete cascade,
  company text not null,
  role text not null,
  focus text not null,
  experience text not null,
  job_description text,
  questions jsonb not null,
  answers jsonb not null,
  feedback jsonb not null,
  resources jsonb not null,
  score smallint not null check (score between 0 and 100),
  created_at timestamptz not null default now()
);

create index if not exists interview_sessions_user_created_idx on public.interview_sessions (user_id, created_at desc);
alter table public.interview_sessions enable row level security;

alter table public.learning_activity drop constraint if exists learning_activity_activity_type_check;
alter table public.learning_activity add constraint learning_activity_activity_type_check check (activity_type in ('lesson', 'quiz', 'course', 'interview'));
