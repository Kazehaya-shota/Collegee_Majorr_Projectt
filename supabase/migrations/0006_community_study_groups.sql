-- CourseMaster Community Space: discoverable study groups and membership.
-- Run this after 0005_community.sql in Supabase SQL Editor.

create table if not exists public.community_groups (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 80),
  topic text not null check (char_length(topic) between 2 and 80),
  description text not null check (char_length(description) between 10 and 300),
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  capacity smallint not null default 30 check (capacity between 2 and 250),
  invite_code text not null unique,
  created_by text not null references public.profiles(clerk_user_id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.community_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.community_groups(id) on delete cascade,
  user_id text not null references public.profiles(clerk_user_id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  status text not null default 'active' check (status in ('active', 'requested')),
  joined_at timestamptz not null default now(),
  unique (group_id, user_id)
);

create index if not exists community_groups_topic_idx on public.community_groups (topic, created_at desc);
create index if not exists community_group_members_group_status_idx on public.community_group_members (group_id, status);
create index if not exists community_group_members_user_idx on public.community_group_members (user_id, status);

alter table public.community_groups enable row level security;
alter table public.community_group_members enable row level security;
