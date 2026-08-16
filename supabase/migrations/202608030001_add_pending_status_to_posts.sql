do $$
declare
  existing_constraint text;
begin
  select conname into existing_constraint
  from pg_constraint
  where conrelid = 'public.posts'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%status%';

  if existing_constraint is not null then
    execute format('alter table public.posts drop constraint %I', existing_constraint);
  end if;
end $$;

alter table public.posts
  add constraint posts_status_check check (status in ('draft', 'pending', 'published', 'rejected'));

alter table public.posts add column rejection_reason text;
alter table public.posts add column moderated_by uuid references public.users(id) on delete set null;
alter table public.posts add column moderated_at timestamptz;
alter table public.posts add column first_published_at timestamptz;

alter table public.users add column approved_posts_count integer not null default 0;

create index posts_author_id_status_idx on public.posts (author_id, status);
