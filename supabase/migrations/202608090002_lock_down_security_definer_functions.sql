-- Standalone on purpose. The same REVOKE block also appears at the end of
-- 202608090001, but `supabase db push` skips any migration whose version is
-- already recorded in supabase_migrations.schema_migrations — so if that file
-- was pushed before the block was appended to it, the block would never run
-- and the repo would read as fixed while the database stayed exposed. A
-- security change has to land as its own version to be guaranteed to apply.
-- Both copies are idempotent, so running them twice is harmless.

-- Why any of this is needed: Supabase's bootstrap sets
--   alter default privileges in schema public
--     grant all on functions to postgres, anon, authenticated, service_role
-- so every function created in `public` is reachable through PostgREST at
-- /rest/v1/rpc/<name> using the project's anon key, which is public by design.
-- All of these are SECURITY DEFINER, so they also bypass the RLS enabled on
-- the tables they touch. Only this backend calls them, and it uses the
-- service-role key.

-- AI quota (repeat of 202608090001's block — see note above).
revoke all on function public.consume_ai_quota(uuid, int) from public, anon, authenticated;
revoke all on function public.consume_global_ai_quota(int) from public, anon, authenticated;
revoke all on function public.refund_ai_quota(uuid, date) from public, anon, authenticated;
revoke all on function public.refund_global_ai_quota(date) from public, anon, authenticated;
revoke all on function public.refund_ai_quota(uuid) from public, anon, authenticated;
revoke all on function public.refund_global_ai_quota() from public, anon, authenticated;

grant execute on function public.consume_ai_quota(uuid, int) to service_role;
grant execute on function public.consume_global_ai_quota(int) to service_role;
grant execute on function public.refund_ai_quota(uuid, date) to service_role;
grant execute on function public.refund_global_ai_quota(date) to service_role;
grant execute on function public.refund_ai_quota(uuid) to service_role;
grant execute on function public.refund_global_ai_quota() to service_role;

-- The three pre-existing functions with the same exposure. Each takes a bare
-- user uuid, and real uuids are handed to anonymous callers already:
-- GET /api/posts/:postId/comments is public and returns comments[].userId.
--
--   increment_token_version      — bumps users.token_version, invalidating
--                                  every access and refresh token that user
--                                  holds. Called in a loop, it keeps a chosen
--                                  member logged out indefinitely.
--   increment_approved_posts_count — inflates a member's tier, lifting the
--                                  anti-spam cap on concurrent pending posts.
--   increment_otp_attempts       — burns a victim's OTP guesses before they
--                                  ever enter one.
revoke all on function public.increment_token_version(uuid) from public, anon, authenticated;
revoke all on function public.increment_approved_posts_count(uuid) from public, anon, authenticated;
revoke all on function public.increment_otp_attempts(uuid) from public, anon, authenticated;

grant execute on function public.increment_token_version(uuid) to service_role;
grant execute on function public.increment_approved_posts_count(uuid) to service_role;
grant execute on function public.increment_otp_attempts(uuid) to service_role;

-- postSchema now caps artist/best_pick/spotify_url at 240 characters, but
-- nothing bounded them before, and that cap is on contentFieldsSchema — which
-- updatePostSchema extends. Without this, a row already over the limit would
-- fail validation on every future edit, including an admin's during review,
-- with no way to shorten it through the API. Almost certainly a no-op.
update public.posts
set artist = left(artist, 240)
where artist is not null and length(artist) > 240;

update public.posts
set best_pick = left(best_pick, 240)
where best_pick is not null and length(best_pick) > 240;

update public.posts
set spotify_url = left(spotify_url, 240)
where spotify_url is not null and length(spotify_url) > 240;
