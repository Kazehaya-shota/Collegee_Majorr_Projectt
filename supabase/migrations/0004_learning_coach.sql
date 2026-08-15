-- CourseMaster Learning Coach conversation history.
-- Run this file in the Supabase SQL Editor after the earlier CourseMaster migrations.

create table if not exists public.coach_messages (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.profiles(clerk_user_id) on delete cascade,
  conversation_id text not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 5000),
  pathname text,
  created_at timestamptz not null default now()
);

create index if not exists coach_messages_user_conversation_created_idx
  on public.coach_messages (user_id, conversation_id, created_at desc);

alter table public.coach_messages enable row level security;
