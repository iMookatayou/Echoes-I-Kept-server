create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null,
  status text not null default 'unread' check (status in ('unread', 'read')),
  actor_name text,
  actor_avatar text,
  action text not null,
  message text,
  article_id bigint references public.posts(id) on delete set null,
  article_title text,
  created_at timestamptz not null default current_timestamp
);

create index notifications_user_id_idx on public.notifications (user_id);

alter table public.notifications enable row level security;

grant select, insert, update, delete on public.notifications to service_role;
