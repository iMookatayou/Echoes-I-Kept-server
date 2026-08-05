-- email_verified defaults to true so every existing row (seed accounts,
-- admin-created members) stays unaffected — only the public signup
-- controller explicitly overrides this to false for new self-serve signups.
alter table public.users
  add column email_verified boolean not null default true;

-- One shared table with a `purpose` discriminator rather than two separate
-- tables: signup verification and password reset need byte-identical CRUD
-- (create, find-active, increment-attempts, consume), so splitting would
-- just duplicate the repository and lockout logic for what's cheaper as one
-- checked column.
create table public.email_otps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  purpose text not null check (purpose in ('signup_verify', 'password_reset')),
  code_hash text not null,
  attempt_count int not null default 0,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default current_timestamp
);

create index email_otps_user_purpose_idx on public.email_otps (user_id, purpose);

-- Same shape as increment_token_version: an atomic counter bump so a
-- read-then-write race from the controller can't grant extra guess attempts.
create or replace function public.increment_otp_attempts(target_otp_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.email_otps set attempt_count = attempt_count + 1 where id = target_otp_id;
$$;

alter table public.email_otps enable row level security;

grant select, insert, update, delete on public.email_otps to service_role;
grant execute on function public.increment_otp_attempts(uuid) to service_role;
