-- The refund functions filtered on `usage_date = current_date`, but the charge
-- they undo happened when the request started. A request that begins just
-- before UTC midnight and fails just after refunds against the *new* day's
-- row: either it doesn't exist yet (no-op — the caller silently loses the slot
-- they were owed) or it does and gets decremented, handing out a free slot
-- while the previous day's row stays over-counted.
--
-- Fixed by having the consume functions report which date they charged, and
-- having the refunds take that date rather than re-deriving it. The refunds
-- keep their old zero-/one-arg forms as thin wrappers so nothing breaks
-- mid-deploy, but callers should pass the date.

-- Adds charged_date to the return. Body is otherwise unchanged from
-- 202608070001; current_date is captured once into a local so the row it
-- writes and the date it reports can never disagree.
--
-- Dropped rather than replaced: adding a column to a table-returning
-- function changes its return type, and CREATE OR REPLACE refuses that.
drop function if exists public.consume_ai_quota(uuid, int);

create function public.consume_ai_quota(target_user_id uuid, daily_limit int)
returns table (allowed boolean, used int, charged_date date)
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_count int;
  current_count int;
  today date := current_date;
begin
  if daily_limit <= 0 then
    return query select false, 0, today;
    return;
  end if;

  insert into public.ai_usage (user_id, usage_date, request_count)
  values (target_user_id, today, 1)
  on conflict (user_id, usage_date) do update
    set request_count = public.ai_usage.request_count + 1,
        updated_at = current_timestamp
    where public.ai_usage.request_count < daily_limit
  returning public.ai_usage.request_count into new_count;

  if new_count is null then
    select ai.request_count into current_count
      from public.ai_usage ai
      where ai.user_id = target_user_id and ai.usage_date = today;
    return query select false, coalesce(current_count, 0), today;
    return;
  end if;

  return query select true, new_count, today;
end;
$$;

drop function if exists public.consume_global_ai_quota(int);

create function public.consume_global_ai_quota(daily_limit int)
returns table (allowed boolean, used int, charged_date date)
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_count int;
  current_count int;
  today date := current_date;
begin
  if daily_limit <= 0 then
    return query select false, 0, today;
    return;
  end if;

  insert into public.ai_global_usage (usage_date, request_count)
  values (today, 1)
  on conflict (usage_date) do update
    set request_count = public.ai_global_usage.request_count + 1,
        updated_at = current_timestamp
    where public.ai_global_usage.request_count < daily_limit
  returning public.ai_global_usage.request_count into new_count;

  if new_count is null then
    select ai.request_count into current_count
      from public.ai_global_usage ai
      where ai.usage_date = today;
    return query select false, coalesce(current_count, 0), today;
    return;
  end if;

  return query select true, new_count, today;
end;
$$;

-- Date-targeted refunds. `greatest(... , 0)` still floors at zero so a
-- double refund can't drive a counter negative and mint free quota.
create or replace function public.refund_ai_quota(target_user_id uuid, target_date date)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.ai_usage
  set request_count = greatest(request_count - 1, 0),
      updated_at = current_timestamp
  where user_id = target_user_id and usage_date = target_date;
$$;

create or replace function public.refund_global_ai_quota(target_date date)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.ai_global_usage
  set request_count = greatest(request_count - 1, 0),
      updated_at = current_timestamp
  where usage_date = target_date;
$$;

-- Kept so a running instance of the previous build doesn't start erroring the
-- moment this migration lands. Same today-based behaviour as before.
create or replace function public.refund_ai_quota(target_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  select public.refund_ai_quota(target_user_id, current_date);
$$;

create or replace function public.refund_global_ai_quota()
returns void
language sql
security definer
set search_path = ''
as $$
  select public.refund_global_ai_quota(current_date);
$$;

grant execute on function public.consume_ai_quota(uuid, int) to service_role;
grant execute on function public.consume_global_ai_quota(int) to service_role;
grant execute on function public.refund_ai_quota(uuid, date) to service_role;
grant execute on function public.refund_global_ai_quota(date) to service_role;
grant execute on function public.refund_ai_quota(uuid) to service_role;
grant execute on function public.refund_global_ai_quota() to service_role;
