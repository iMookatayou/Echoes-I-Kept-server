create or replace function public.increment_approved_posts_count(target_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.users set approved_posts_count = approved_posts_count + 1 where id = target_user_id;
$$;

grant execute on function public.increment_approved_posts_count(uuid) to service_role;
