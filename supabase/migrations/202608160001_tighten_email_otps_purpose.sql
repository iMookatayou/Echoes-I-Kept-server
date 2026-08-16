-- Password reset moved from an OTP code to a single-use link token
-- (202608120004_create_password_reset_tokens.sql) — email_otps no longer
-- ever issues a 'password_reset' row, only 'signup_verify'. Any leftover
-- 'password_reset' rows are stale test data from before that switch, safe
-- to drop; tighten the constraint to match what the app actually writes.
delete from public.email_otps where purpose = 'password_reset';

alter table public.email_otps
  drop constraint email_otps_purpose_check;

alter table public.email_otps
  add constraint email_otps_purpose_check check (purpose = 'signup_verify');
