-- CourseMaster Community Space: reports and owner moderation queues.
-- Run after the previous Community and Resource Exchange migrations.

create table if not exists public.community_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id text not null references public.profiles(clerk_user_id) on delete cascade,
  assigned_to text references public.profiles(clerk_user_id) on delete set null,
  target_type text not null check (target_type in ('group', 'room', 'post', 'reply', 'resource', 'resource_comment')),
  target_id uuid not null,
  target_label text not null default '',
  reason text not null check (reason in ('inappropriate', 'harassment', 'spam', 'unsafe', 'other')),
  details text not null default '' check (char_length(details) <= 600),
  status text not null default 'open' check (status in ('open', 'resolved', 'removed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (reporter_id, target_type, target_id)
);

create index if not exists community_reports_assigned_status_idx on public.community_reports (assigned_to, status, created_at desc);
create index if not exists community_reports_target_idx on public.community_reports (target_type, target_id);

alter table public.community_reports enable row level security;
