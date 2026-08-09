-- consume_ai_quota charges a slot before the Gemini call is made, which is
-- the right order for cost control (never spend API money on a call that
-- was already over quota). But that means a transport-layer failure — a
-- misconfigured model name, a transient 5xx from the provider, our own bug —
-- burns the user's daily allowance for a call that never actually ran. This
-- gives the controller a way to hand the slot back when that happens, while
-- leaving quota charged for anything that reached the model (a refusal or an
-- unparseable response still cost real tokens).
create or replace function public.refund_ai_quota(target_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.ai_usage
  set request_count = greatest(request_count - 1, 0),
      updated_at = current_timestamp
  where user_id = target_user_id and usage_date = current_date;
$$;

grant execute on function public.refund_ai_quota(uuid) to service_role;
