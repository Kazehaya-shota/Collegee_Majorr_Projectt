-- Varen AI request limits.
-- Run after the earlier Varen migrations.

create table if not exists public.ai_request_limits (
  user_id text not null references public.profiles(clerk_user_id) on delete cascade,
  action text not null check (action in ('course_generation', 'course_refinement')),
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, action)
);

alter table public.ai_request_limits enable row level security;

create or replace function public.consume_ai_request(
  p_user_id text,
  p_action text,
  p_max_requests integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_window timestamptz;
  current_count integer;
begin
  if p_max_requests < 1 or p_window_seconds < 1 then
    raise exception 'Invalid AI request limit';
  end if;

  insert into public.ai_request_limits (user_id, action)
  values (p_user_id, p_action)
  on conflict (user_id, action) do nothing;

  select window_started_at, request_count
    into current_window, current_count
    from public.ai_request_limits
    where user_id = p_user_id and action = p_action
    for update;

  if current_window <= now() - make_interval(secs => p_window_seconds) then
    update public.ai_request_limits
      set window_started_at = now(), request_count = 1, updated_at = now()
      where user_id = p_user_id and action = p_action;
    return true;
  end if;

  if current_count >= p_max_requests then
    return false;
  end if;

  update public.ai_request_limits
    set request_count = request_count + 1, updated_at = now()
    where user_id = p_user_id and action = p_action;
  return true;
end;
$$;

revoke all on function public.consume_ai_request(text, text, integer, integer) from public;
grant execute on function public.consume_ai_request(text, text, integer, integer) to service_role;
