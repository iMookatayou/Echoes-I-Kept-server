-- ai_usage's (user_id, usage_date) key meant every /api/ai endpoint shared
-- one daily counter per user. That was fine while every endpoint was "an
-- author, once, on their own draft" (polish, presubmit-check, moderate) —
-- but /api/ai/translate is reader-facing and can be triggered many times
-- just browsing different articles, and sharing quota with the writing
-- tools means using it up blocks polish/presubmit for the rest of the day,
-- and vice versa. Splits the *personal* counter by category so translating
-- articles and drafting a post no longer compete for the same daily budget.
--
-- ai_global_usage is deliberately left untouched: it exists to model
-- Google's real per-project-per-day ceiling (see its own migration), which
-- actually is shared across every call this app makes regardless of what we
-- call it — splitting that one by category would let the combined real
-- Gemini traffic exceed the actual external limit.
alter table public.ai_usage add column category text not null default 'writing_assist';
alter table public.ai_usage drop constraint ai_usage_user_id_usage_date_key;
alter table public.ai_usage
  add constraint ai_usage_user_id_usage_date_category_key unique (user_id, usage_date, category);

drop function if exists public.consume_ai_quota(uuid, int);

create function public.consume_ai_quota(
  target_user_id uuid,
  daily_limit int,
  target_category text default 'writing_assist'
)
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

  insert into public.ai_usage (user_id, usage_date, category, request_count)
  values (target_user_id, today, target_category, 1)
  on conflict (user_id, usage_date, category) do update
    set request_count = public.ai_usage.request_count + 1,
        updated_at = current_timestamp
    where public.ai_usage.request_count < daily_limit
  returning public.ai_usage.request_count into new_count;

  if new_count is null then
    select ai.request_count into current_count
      from public.ai_usage ai
      where ai.user_id = target_user_id
        and ai.usage_date = today
        and ai.category = target_category;
    return query select false, coalesce(current_count, 0), today;
    return;
  end if;

  return query select true, new_count, today;
end;
$$;

drop function if exists public.refund_ai_quota(uuid, date);
drop function if exists public.refund_ai_quota(uuid);

create function public.refund_ai_quota(
  target_user_id uuid,
  target_date date,
  target_category text default 'writing_assist'
)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.ai_usage
  set request_count = greatest(request_count - 1, 0),
      updated_at = current_timestamp
  where user_id = target_user_id and usage_date = target_date and category = target_category;
$$;

-- Kept as a thin wrapper so a running instance of the previous build doesn't
-- start erroring the moment this migration lands, same as the original
-- reasoning in 202608090001.
create function public.refund_ai_quota(target_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  select public.refund_ai_quota(target_user_id, current_date, 'writing_assist');
$$;

-- Every new/replaced signature needs its own explicit grant — Supabase's
-- default-privileges bootstrap makes a freshly created function callable via
-- PostgREST with the anon key otherwise, and these are SECURITY DEFINER.
revoke all on function public.consume_ai_quota(uuid, int, text) from public, anon, authenticated;
revoke all on function public.refund_ai_quota(uuid, date, text) from public, anon, authenticated;
revoke all on function public.refund_ai_quota(uuid) from public, anon, authenticated;

grant execute on function public.consume_ai_quota(uuid, int, text) to service_role;
grant execute on function public.refund_ai_quota(uuid, date, text) to service_role;
grant execute on function public.refund_ai_quota(uuid) to service_role;
