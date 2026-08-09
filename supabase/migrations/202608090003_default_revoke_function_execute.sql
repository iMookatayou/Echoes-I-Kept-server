-- 202608090002 (and a33b329 before it) each hand-listed function signatures to
-- revoke. That treats the symptom: the cause is Supabase's bootstrap
--
--   alter default privileges in schema public
--     grant all on functions to postgres, anon, authenticated, service_role
--
-- which re-grants EXECUTE to anon on every *future* function the moment it is
-- created. Any new SECURITY DEFINER function is then reachable at
-- /rest/v1/rpc/<name> with the public anon key and bypasses RLS, and the only
-- thing standing between that and a hole is remembering to add another line to
-- a list. Two statements close it for good.

-- Existing functions, including any the hand-written lists missed — e.g.
-- public.enforce_pending_submission_cap(), which is SECURITY DEFINER and was
-- not in 202608090002 despite that commit claiming to cover all of them. (It
-- isn't exploitable: PostgREST doesn't expose `returns trigger` functions and
-- Postgres refuses a direct call. It's covered here anyway, for free.)
revoke execute on all functions in schema public from anon, authenticated;

-- Future functions created by the role that runs migrations. Nothing in this
-- project is meant to be called over PostgREST at all — the Express API is the
-- only client and it authenticates with the service-role key — so denying by
-- default and granting explicitly is the correct posture.
alter default privileges in schema public revoke execute on functions from anon, authenticated;

-- Re-assert the grants the API actually relies on. `revoke ... on all
-- functions` above is indiscriminate, so service_role has to be restored.
grant execute on all functions in schema public to service_role;

-- Correction to 202608090002's comment (and its commit message): that file
-- claimed all three pre-existing functions "take a bare user uuid" harvestable
-- from the public comments endpoint, and that increment_otp_attempts lets an
-- attacker burn a victim's OTP guesses. That is wrong for that one function —
-- its parameter is target_otp_id, a row id in email_otps, which no endpoint
-- ever returns, so the attack described is infeasible. The genuinely
-- exploitable pair was increment_token_version and
-- increment_approved_posts_count, both of which really do take a user uuid.
-- Revoking increment_otp_attempts remains right as defence in depth.

-- The 202608090002 backfill bounded artist/best_pick/spotify_url with
-- Postgres length()/left(), which count code points, while the zod .max(240)
-- it exists to satisfy counts UTF-16 code units. A value of 130 astral-plane
-- characters (emoji) is 130 code points but 260 UTF-16 units: the old WHERE
-- clause skipped it, so the row stayed permanently uneditable through the API
-- — the exact failure the backfill was added to prevent. Redone below against
-- a UTF-16-equivalent measure.
--
-- Note octet_length would be the wrong yardstick here: Thai text is 3 bytes
-- per character in UTF-8 but 1 UTF-16 unit, so byte length would truncate
-- perfectly valid Thai artist names.
create function public.pg_temp_utf16_len(t text)
returns int
language sql
immutable
as $$
  -- Each astral character is one code point but two UTF-16 units, so the
  -- UTF-16 length is the code-point count plus the number of astral chars.
  -- Astral characters are exactly those encoding to 4 bytes in UTF-8, which
  -- avoids depending on \U escape handling in the regex engine.
  select length(t) + (
    select count(*)
    from regexp_split_to_table(t, '') as ch
    where octet_length(ch) = 4
  )::int;
$$;

-- Two passes per column: trim to 240 code points first so ordinary text keeps
-- as much as possible, then clamp anything still over (astral-heavy values) to
-- 120 code points, which cannot exceed 240 UTF-16 units under any encoding.
update public.posts set artist = left(artist, 240)
  where artist is not null and public.pg_temp_utf16_len(artist) > 240;
update public.posts set artist = left(artist, 120)
  where artist is not null and public.pg_temp_utf16_len(artist) > 240;

update public.posts set best_pick = left(best_pick, 240)
  where best_pick is not null and public.pg_temp_utf16_len(best_pick) > 240;
update public.posts set best_pick = left(best_pick, 120)
  where best_pick is not null and public.pg_temp_utf16_len(best_pick) > 240;

update public.posts set spotify_url = left(spotify_url, 240)
  where spotify_url is not null and public.pg_temp_utf16_len(spotify_url) > 240;
update public.posts set spotify_url = left(spotify_url, 120)
  where spotify_url is not null and public.pg_temp_utf16_len(spotify_url) > 240;

drop function public.pg_temp_utf16_len(text);
