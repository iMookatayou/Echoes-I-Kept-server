create table public.users (
  id uuid primary key default gen_random_uuid(),
  email varchar(255) unique not null,
  username varchar(100) unique not null,
  password_hash varchar(255) not null,
  first_name varchar(100),
  last_name varchar(100),
  role text not null default 'user' check (role in ('user', 'admin')),
  profile_pic text,
  token_version int not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default current_timestamp,
  updated_at timestamptz not null default current_timestamp
);

create trigger users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

create table public.refresh_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default current_timestamp
);

create index refresh_tokens_user_id_idx on public.refresh_tokens (user_id);

create or replace function public.increment_token_version(target_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.users set token_version = token_version + 1 where id = target_user_id;
$$;

alter table public.users enable row level security;
alter table public.refresh_tokens enable row level security;

grant usage on schema public to service_role;
grant select, insert, update, delete on public.users to service_role;
grant select, insert, update, delete on public.refresh_tokens to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on function public.increment_token_version(uuid) to service_role;
