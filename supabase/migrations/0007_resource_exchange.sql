-- CourseMaster Resource Exchange: signed-in learners can share and discuss learning resources.
-- Run after the earlier CourseMaster and Community migrations.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'community-resources',
  'community-resources',
  false,
  52428800,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/markdown',
    'text/csv',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.community_resources (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null references public.profiles(clerk_user_id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  description text not null default '' check (char_length(description) <= 600),
  subject text not null check (char_length(subject) between 2 and 80),
  tags text[] not null default '{}',
  resource_type text not null check (resource_type in ('file', 'link')),
  original_name text,
  mime_type text,
  file_size bigint check (file_size is null or file_size >= 0),
  object_path text unique,
  external_url text,
  status text not null default 'uploading' check (status in ('uploading', 'published')),
  created_at timestamptz not null default now(),
  check ((resource_type = 'file' and object_path is not null and external_url is null) or (resource_type = 'link' and external_url is not null and object_path is null))
);

create table if not exists public.community_resource_saves (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.community_resources(id) on delete cascade,
  user_id text not null references public.profiles(clerk_user_id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (resource_id, user_id)
);

create table if not exists public.community_resource_reactions (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.community_resources(id) on delete cascade,
  user_id text not null references public.profiles(clerk_user_id) on delete cascade,
  kind text not null default 'helpful' check (kind in ('helpful')),
  created_at timestamptz not null default now(),
  unique (resource_id, user_id, kind)
);

create table if not exists public.community_resource_comments (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.community_resources(id) on delete cascade,
  author_id text not null references public.profiles(clerk_user_id) on delete cascade,
  body text not null check (char_length(body) between 2 and 1200),
  created_at timestamptz not null default now()
);

create index if not exists community_resources_subject_created_idx on public.community_resources (subject, created_at desc) where status = 'published';
create index if not exists community_resource_saves_resource_idx on public.community_resource_saves (resource_id);
create index if not exists community_resource_reactions_resource_idx on public.community_resource_reactions (resource_id);
create index if not exists community_resource_comments_resource_created_idx on public.community_resource_comments (resource_id, created_at asc);

alter table public.community_resources enable row level security;
alter table public.community_resource_saves enable row level security;
alter table public.community_resource_reactions enable row level security;
alter table public.community_resource_comments enable row level security;
