-- Varen's application data is linked to Clerk by the stable Clerk user ID.
-- Run this whole file in the Supabase SQL Editor after creating your project.

create table if not exists public.profiles (
  clerk_user_id text primary key,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null references public.profiles(clerk_user_id) on delete cascade,
  title text not null,
  summary text not null,
  topic text not null,
  level text,
  daily_time text,
  estimated_minutes integer not null check (estimated_minutes > 0),
  status text not null default 'active' check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists courses_owner_updated_at_idx on public.courses (owner_id, updated_at desc);

create table if not exists public.course_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  position smallint not null check (position > 0),
  title text not null,
  description text not null,
  estimated_minutes integer not null check (estimated_minutes > 0),
  created_at timestamptz not null default now(),
  unique (course_id, position)
);

create table if not exists public.course_sources (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  source_type text not null default 'link' check (source_type in ('link', 'note', 'pdf', 'video')),
  label text not null,
  url text,
  source_text text,
  created_at timestamptz not null default now()
);

create table if not exists public.module_progress (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.profiles(clerk_user_id) on delete cascade,
  module_id uuid not null references public.course_modules(id) on delete cascade,
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'completed')),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, module_id)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists courses_set_updated_at on public.courses;
create trigger courses_set_updated_at before update on public.courses
for each row execute function public.set_updated_at();

drop trigger if exists module_progress_set_updated_at on public.module_progress;
create trigger module_progress_set_updated_at before update on public.module_progress
for each row execute function public.set_updated_at();

-- Application access always goes through Clerk-authenticated server routes.
-- Keep RLS enabled so a future browser client cannot read data by accident.
alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.course_modules enable row level security;
alter table public.course_sources enable row level security;
alter table public.module_progress enable row level security;
