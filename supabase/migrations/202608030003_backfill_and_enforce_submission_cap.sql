-- Posts that were already live before first_published_at existed would
-- otherwise lose their original publication date the first time they were
-- routed back through pending and re-approved.
update public.posts
set first_published_at = published_at
where status = 'published'
  and published_at is not null
  and first_published_at is null;

-- The application checks the submission cap before inserting, but that's a
-- read-then-write across two round trips: N concurrent submissions from the
-- same member all observe the same pending count and all succeed. Since the
-- cap is an anti-spam control, it needs a backstop that can't be raced.
-- Locking the author's user row serialises concurrent submissions per author.
create or replace function public.enforce_pending_submission_cap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  author_role text;
  approved_count integer;
  pending_count integer;
  cap integer;
begin
  if new.author_id is null or new.status <> 'pending' then
    return new;
  end if;

  select role, approved_posts_count
  into author_role, approved_count
  from public.users
  where id = new.author_id
  for update;

  if author_role is null or author_role = 'admin' then
    return new;
  end if;

  cap := case
    when approved_count >= 5 then 7
    when approved_count >= 1 then 3
    else 1
  end;

  select count(*) into pending_count
  from public.posts
  where author_id = new.author_id
    and status = 'pending'
    and id is distinct from new.id;

  if pending_count >= cap then
    raise exception 'SUBMISSION_LIMIT: at most % pending post(s) allowed', cap;
  end if;

  return new;
end $$;

create trigger posts_enforce_pending_submission_cap
before insert or update of status on public.posts
for each row execute function public.enforce_pending_submission_cap();
