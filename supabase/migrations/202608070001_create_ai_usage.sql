-- Per-user daily quota for the /api/ai endpoints.
--
-- The express-rate-limit backstop in middleware/rateLimit.js is per-IP, and on
-- Vercel's serverless runtime its store isn't shared across function
-- instances — same caveat already documented for the OTP limiters. Since every
-- AI call costs real money, the authoritative limit has to live in the
-- database and be keyed to the user, not the IP.
create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  usage_date date not null default current_date,
  request_count int not null default 0,
  created_at timestamptz not null default current_timestamp,
  updated_at timestamptz not null default current_timestamp,
  unique (user_id, usage_date)
);

-- Check-and-increment in one statement. The controller could read the count
-- and then write it back, but that's the same read-then-write race the posts
-- submission cap trigger exists to close — a caller firing requests in
-- parallel would slip past a limit enforced in application code.
create or replace function public.consume_ai_quota(target_user_id uuid, daily_limit int)
returns table (allowed boolean, used int)
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_count int;
  current_count int;
begin
  if daily_limit <= 0 then
    return query select false, 0;
    return;
  end if;

  insert into public.ai_usage (user_id, usage_date, request_count)
  values (target_user_id, current_date, 1)
  on conflict (user_id, usage_date) do update
    set request_count = public.ai_usage.request_count + 1,
        updated_at = current_timestamp
    where public.ai_usage.request_count < daily_limit
  returning public.ai_usage.request_count into new_count;

  -- RETURNING yields no row when the ON CONFLICT predicate blocked the
  -- update, which is exactly the at-or-over-limit case.
  if new_count is null then
    select ai.request_count into current_count
      from public.ai_usage ai
      where ai.user_id = target_user_id and ai.usage_date = current_date;
    return query select false, coalesce(current_count, 0);
    return;
  end if;

  return query select true, new_count;
end;
$$;

alter table public.ai_usage enable row level security;

grant select, insert, update, delete on public.ai_usage to service_role;
grant execute on function public.consume_ai_quota(uuid, int) to service_role;
