-- Replaces the OTP-code password reset flow with a single-use, time-limited
-- link token (OWASP Forgot Password Cheat Sheet's recommended shape) — same
-- structure as refresh_tokens: a random opaque value is emailed, only its
-- SHA-256 hash is ever stored, and used_at marks it single-use. Unlike
-- refresh_tokens this never needs revoking early (no "log out" concept for a
-- token that only ever does one thing once), so there's no separate revoke
-- path, just used_at.
create table public.password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default current_timestamp
);

create index password_reset_tokens_user_id_idx on public.password_reset_tokens (user_id);

alter table public.password_reset_tokens enable row level security;

grant select, insert, update, delete on public.password_reset_tokens to service_role;
