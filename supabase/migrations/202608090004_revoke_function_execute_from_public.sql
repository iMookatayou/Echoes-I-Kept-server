-- 202608090003 did not do what it claimed. It ran
--
--   revoke execute on all functions in schema public from anon, authenticated;
--
-- which strips only the explicit anon=X / authenticated=X ACL entries.
-- Postgres additionally grants EXECUTE to PUBLIC on every function at creation
-- time (the built-in =X/owner entry), and that was left untouched. anon is a
-- member of PUBLIC, so the privilege survived by that route. The same omission
-- was in its `alter default privileges` line.
--
-- Scope of what that actually left open, stated precisely: 202608090002 had
-- already locked down nine functions with a correct
-- `from public, anon, authenticated`. The only ones outside that list are
-- set_updated_at(), adjust_post_likes_count() and
-- enforce_pending_submission_cap() — all three `returns trigger`, which
-- PostgREST does not expose under /rest/v1/rpc/ and Postgres refuses to call
-- directly. So no anon-reachable function was left exposed; there was no live
-- RPC hole. (An earlier draft of this file said otherwise. It was wrong, in
-- the same way the increment_otp_attempts note in 0002 was wrong, and both
-- overstatements are worth naming rather than quietly deleting: a future
-- auditor reading an inflated claim may go looking for a breach that never
-- happened, or discount an accurate one later.)
--
-- The genuine and sufficient reason for this migration is the *future* half:
-- with default privileges unfixed, the next function added to public — a
-- SECURITY DEFINER one reachable over PostgREST, unlike the three trigger
-- functions above — is created anon-executable, and the only thing preventing
-- that is someone remembering to revoke by hand.

-- Existing functions. Two filters, both deliberate:
--   * extension-owned functions are skipped — they are not ours to
--     re-permission, and revoking PUBLIC on them can break legitimate callers;
--   * functions whose owner this role has no membership in are counted and
--     raised on rather than attempted, because REVOKE without grant option
--     emits a WARNING and continues, which would let this migration report
--     success while leaving the grant in place. That is the exact
--     "reads as fixed while the database stays exposed" failure 0002 was
--     written to avoid.
-- `routine` rather than `function`: the FUNCTION syntax rejects procedures, so
-- a procedure added later would abort this migration on every db reset.
do $$
declare
  fn record;
  unowned int;
begin
  select count(*) into unowned
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
    and not pg_has_role(p.proowner, 'USAGE');

  if unowned > 0 then
    raise exception
      'cannot revoke EXECUTE on % public function(s) owned by a role this migration is not a member of; they would keep their PUBLIC grant silently',
      unowned;
  end if;

  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('revoke execute on routine %s from public, anon, authenticated', fn.sig);
    execute format('grant execute on routine %s to service_role', fn.sig);
  end loop;
end;
$$;

-- Future functions. The bare form binds to the role running this migration;
-- the guarded block covers `postgres` when that is a different role (Supabase's
-- bootstrap registers its grant under postgres). Revoke and grant are applied
-- to the same grantor in both cases — revoking for two roles while granting
-- for only one would leave functions later created by postgres with no
-- service_role EXECUTE, breaking every supabase.rpc() call in the API.
alter default privileges in schema public
  revoke execute on functions from public, anon, authenticated;
alter default privileges in schema public
  grant execute on functions to service_role;

do $$
begin
  alter default privileges for role postgres in schema public
    revoke execute on functions from public, anon, authenticated;
  alter default privileges for role postgres in schema public
    grant execute on functions to service_role;
exception
  when insufficient_privilege or undefined_object then
    raise notice 'skipped default privileges for role postgres: %', sqlerrm;
end;
$$;

-- The block above can legitimately no-op (when the runner *is* postgres) or
-- silently fail to apply (when it is a role with no membership in postgres),
-- and a NOTICE does not distinguish them — `db push` would report success
-- either way. This asserts the end state instead of trusting the statements.
--
-- What it proves: no *existing* pg_default_acl entry for public functions
-- still hands EXECUTE to PUBLIC, anon or authenticated. What it cannot prove:
-- that some role with no entry at all won't later create a function, since
-- absent an entry Postgres falls back to its built-in PUBLIC grant, and there
-- is no way to enumerate roles that might create one in future. The revokes
-- above cover the role running migrations and postgres, which is every role
-- that creates functions in this project.
do $$
declare
  leaked int;
begin
  select count(*) into leaked
  from pg_default_acl d
  join pg_namespace n on n.oid = d.defaclnamespace
  cross join lateral aclexplode(d.defaclacl) a
  where n.nspname = 'public'
    and d.defaclobjtype = 'f'
    and a.privilege_type = 'EXECUTE'
    and (
      a.grantee = 0                                   -- PUBLIC
      or a.grantee = to_regrole('anon')::oid
      or a.grantee = to_regrole('authenticated')::oid
    );

  if leaked > 0 then
    raise exception
      'default privileges in schema public still grant EXECUTE to PUBLIC/anon/authenticated in % entr(ies); future functions would be created anon-callable',
      leaked;
  end if;
end;
$$;

-- Two problems in 202608090003 that cannot be repaired in SQL, recorded here
-- so they are not rediscovered from scratch:
--
-- Its backfill's second pass clamped artist/best_pick/spotify_url to 120 code
-- points for any value still over 240 UTF-16 units after the first pass,
-- regardless of overage. A 240-character value containing one emoji is 241
-- units: the first pass left it unchanged and the second cut it to 120,
-- discarding 120 valid characters to shed one unit. The correct target is the
-- longest prefix at or under 240 units. That migration has run and is
-- irreversible; no row exceeds the cap now, so there is nothing left to
-- re-truncate, but any damage stands. To check whether a row was hit:
--
--   select id, length(artist), length(best_pick), length(spotify_url)
--   from posts
--   where length(artist) in (120, 240)
--      or length(best_pick) in (120, 240)
--      or length(spotify_url) in (120, 240);
--
-- Its helper was created as public.pg_temp_utf16_len — a real function in
-- public despite the name — with plain `create`, so a re-run after a partial
-- failure would abort on "already exists". It was dropped at the end of a
-- successful run.
