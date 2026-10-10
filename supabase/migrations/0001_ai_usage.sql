-- Phase D: daily AI quota counter (replaces in-memory express-rate-limit,
-- which is useless on serverless where every invocation is isolated).
-- One row per user per day; incremented atomically via bump_ai_usage().

create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null default (current_date),
  count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

create index if not exists ai_usage_user_day_idx
  on public.ai_usage (user_id, day);

alter table public.ai_usage enable row level security;

drop policy if exists ai_usage_select_own on public.ai_usage;
create policy ai_usage_select_own
  on public.ai_usage for select
  using (user_id = auth.uid());

drop policy if exists ai_usage_insert_own on public.ai_usage;
create policy ai_usage_insert_own
  on public.ai_usage for insert
  with check (user_id = auth.uid());

drop policy if exists ai_usage_update_own on public.ai_usage;
create policy ai_usage_update_own
  on public.ai_usage for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Atomic increment owned by the caller (auth.uid()); SECURITY DEFINER keeps
-- the write safe under RLS while avoiding select-then-upsert races.
create or replace function public.bump_ai_usage()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  c integer;
begin
  insert into public.ai_usage (user_id, day, count)
  values (auth.uid(), current_date, 1)
  on conflict (user_id, day)
  do update set count = public.ai_usage.count + 1, updated_at = now()
  returning public.ai_usage.count into c;
  return c;
end;
$$;

grant execute on function public.bump_ai_usage() to authenticated;
