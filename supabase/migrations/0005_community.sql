-- CourseMaster Community: study rooms, quiz challenges, and events.
-- Run this file in the Supabase SQL Editor after the earlier CourseMaster migrations.

create table if not exists public.community_rooms (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 80),
  topic text not null check (char_length(topic) between 2 and 80),
  description text not null check (char_length(description) between 10 and 300),
  created_by text not null references public.profiles(clerk_user_id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.community_rooms(id) on delete cascade,
  author_id text not null references public.profiles(clerk_user_id) on delete cascade,
  body text not null check (char_length(body) between 3 and 1800),
  upvotes integer not null default 0 check (upvotes >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.community_replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  author_id text not null references public.profiles(clerk_user_id) on delete cascade,
  body text not null check (char_length(body) between 2 and 1200),
  created_at timestamptz not null default now()
);

create table if not exists public.community_challenges (
  id uuid primary key default gen_random_uuid(),
  created_by text not null references public.profiles(clerk_user_id) on delete cascade,
  title text not null check (char_length(title) between 3 and 100),
  topic text not null check (char_length(topic) between 2 and 120),
  duration_minutes smallint not null default 10 check (duration_minutes between 3 and 60),
  invite_code text not null unique,
  questions jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.community_challenge_entries (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.community_challenges(id) on delete cascade,
  user_id text not null references public.profiles(clerk_user_id) on delete cascade,
  answers jsonb,
  score smallint check (score between 0 and 100),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (challenge_id, user_id)
);

create table if not exists public.community_events (
  id uuid primary key default gen_random_uuid(),
  created_by text not null references public.profiles(clerk_user_id) on delete cascade,
  title text not null check (char_length(title) between 3 and 100),
  description text not null check (char_length(description) between 10 and 800),
  event_date timestamptz not null,
  team_size smallint not null default 4 check (team_size between 1 and 12),
  skills text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.community_event_members (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.community_events(id) on delete cascade,
  user_id text not null references public.profiles(clerk_user_id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create index if not exists community_posts_room_created_idx on public.community_posts (room_id, created_at desc);
create index if not exists community_replies_post_created_idx on public.community_replies (post_id, created_at asc);
create index if not exists community_challenge_entries_challenge_score_idx on public.community_challenge_entries (challenge_id, score desc nulls last);
create index if not exists community_event_members_event_idx on public.community_event_members (event_id);

alter table public.community_rooms enable row level security;
alter table public.community_posts enable row level security;
alter table public.community_replies enable row level security;
alter table public.community_challenges enable row level security;
alter table public.community_challenge_entries enable row level security;
alter table public.community_events enable row level security;
alter table public.community_event_members enable row level security;
