-- Google's free tier caps generate_content requests **per project per model
-- per day**, not per user — confirmed live: gemini-3.6-flash (what the
-- "gemini-flash-latest" alias currently resolves to) returned
-- "limit: 20, model: gemini-3.6-flash" on the
-- GenerateRequestsPerDayPerProjectPerModel-FreeTier quota. That number is
-- shared across every user of this site and every one of the three AI
-- endpoints (they all call the same model). A per-user daily allowance alone
-- can't express that shared ceiling — one user well under their own limit
-- can still exhaust the whole site's budget for the day. This table tracks
-- that shared budget so the app can refuse gracefully before Google does.
create table public.ai_global_usage (
  usage_date date primary key default current_date,
  request_count int not null default 0,
  updated_at timestamptz not null default current_timestamp
);

-- Same atomic check-and-increment shape as consume_ai_quota, keyed by date
-- only instead of (user_id, date).
create or replace function public.consume_global_ai_quota(daily_limit int)
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

  insert into public.ai_global_usage (usage_date, request_count)
  values (current_date, 1)
  on conflict (usage_date) do update
    set request_count = public.ai_global_usage.request_count + 1,
        updated_at = current_timestamp
    where public.ai_global_usage.request_count < daily_limit
  returning public.ai_global_usage.request_count into new_count;

  if new_count is null then
    select ai.request_count into current_count
      from public.ai_global_usage ai
      where ai.usage_date = current_date;
    return query select false, coalesce(current_count, 0);
    return;
  end if;

  return query select true, new_count;
end;
$$;

create or replace function public.refund_global_ai_quota()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.ai_global_usage
  set request_count = greatest(request_count - 1, 0),
      updated_at = current_timestamp
  where usage_date = current_date;
$$;

alter table public.ai_global_usage enable row level security;

grant select, insert, update, delete on public.ai_global_usage to service_role;
grant execute on function public.consume_global_ai_quota(int) to service_role;
grant execute on function public.refund_global_ai_quota() to service_role;
