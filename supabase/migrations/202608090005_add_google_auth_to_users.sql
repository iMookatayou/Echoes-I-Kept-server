-- Google sign-in accounts have no password, and can later be created without
-- ever setting one — password_hash can no longer be not-null.
alter table public.users alter column password_hash drop not null;

alter table public.users add column google_id text unique;

-- Neither auth path is optional in isolation: without this, a bug in either
-- signup flow could insert a row nobody can ever log into (no password, no
-- linked Google account).
alter table public.users
  add constraint users_has_login_method
  check (password_hash is not null or google_id is not null);
