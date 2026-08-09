-- 202608090003 does not do what it says. It ran
--
--   revoke execute on all functions in schema public from anon, authenticated;
--
-- which only strips the explicit anon=X / authenticated=X ACL entries. Postgres
-- additionally grants EXECUTE to PUBLIC on every function at creation time
-- (the built-in =X/owner entry), and that was left untouched. anon and
-- authenticated are members of PUBLIC, so has_function_privilege('anon', …,
-- 'EXECUTE') still returns true and PostgREST still exposes every function at
-- /rest/v1/rpc/<name> to the public anon key. The "deny by default" posture
-- that commit claimed to establish was never actually in effect.
--
-- 202608090002 got this right for the functions it enumerated (it revoked
-- `from public, anon, authenticated`), so the six AI functions plus the three
-- named pre-existing ones are genuinely locked down. What 0003 failed to cover
-- is everything else — including public.enforce_pending_submission_cap(), the
-- very function it cited as its motivating example — and, more importantly,
-- every function added from here on.

-- Existing functions. Extension-owned functions are skipped: revoking PUBLIC
-- execute on those can break callers that legitimately rely on them, and they
-- are not ours to re-permission.
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and not exists (
        select 1 from pg_depend d
        where d.objid = p.oid and d.deptype = 'e'
      )
  loop
    execute format(
      'revoke execute on function %s from public, anon, authenticated',
      fn.sig
    );
  end loop;
end;
$$;

-- Future functions. The bare form binds to the role executing this migration;
-- `for role postgres` covers the role Supabase's migration runner uses when
-- they differ. Either may be a no-op depending on who runs it, so a failure on
-- the second must not abort the first.
alter default privileges in schema public
  revoke execute on functions from public, anon, authenticated;

do $$
begin
  alter default privileges for role postgres in schema public
    revoke execute on functions from public, anon, authenticated;
exception
  when insufficient_privilege or undefined_object then
    raise notice 'skipped default privileges for role postgres: %', sqlerrm;
end;
$$;

-- Now genuinely required, unlike the equivalent line in 0003. That one claimed
-- to be restoring access after an "indiscriminate" revoke, but the revoke there
-- named only anon and authenticated, so service_role had never lost anything
-- and the grant was a no-op. Revoking PUBLIC above really can take EXECUTE away
-- from service_role on any function whose only grant came via PUBLIC, so this
-- has to run after it.
grant execute on all functions in schema public to service_role;

alter default privileges in schema public grant execute on functions to service_role;

-- Two further notes on 202608090003, neither actionable in SQL now:
--
-- Its backfill's second pass clamped artist/best_pick/spotify_url to 120 code
-- points for any value still over 240 UTF-16 units after the first pass,
-- regardless of how far over it was. A 240-character value containing one
-- emoji is 241 units, and it was cut to 120 — discarding 120 valid characters
-- to shed one unit of overage. The correct target is the longest prefix at or
-- under 240 units. That migration has already run and is irreversible; no row
-- exceeds the cap now, so there is nothing left to re-truncate, but the data
-- loss stands if any row was affected. See the verification query in the
-- commit message.
--
-- Its helper was created as public.pg_temp_utf16_len despite the name — a real
-- function in public, not a temp one — with plain `create`, so a re-run after a
-- partial failure would abort on "already exists". It was dropped at the end of
-- a successful run, so nothing should remain; the DO block above would have
-- covered it anyway had it survived.
