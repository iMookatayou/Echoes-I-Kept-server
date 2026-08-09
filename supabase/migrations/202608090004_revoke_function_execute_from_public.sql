-- 202608090003 revoked EXECUTE from anon/authenticated but not from PUBLIC,
-- and Postgres grants EXECUTE to PUBLIC on every function at creation. anon is
-- a member of PUBLIC, so the privilege survived by that route.
--
-- Nothing anon-reachable was actually exposed: 202608090002 had already locked
-- down all nine callable functions, and the three it missed are `returns
-- trigger`, which PostgREST does not expose. The gap that matters is future
-- functions — without fixed default privileges, the next one is created
-- anon-callable unless someone remembers to revoke by hand.

-- ROUTINE, not FUNCTION: the FUNCTION syntax rejects procedures, so one added
-- later would abort this on every db reset.
-- Extension-owned functions are skipped (not ours to re-permission), and
-- functions owned by a role we lack membership in are raised on rather than
-- attempted — REVOKE without grant option only WARNs, which would report
-- success while leaving the grant in place.
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
      'cannot revoke EXECUTE on % public function(s) owned by an unrelated role', unowned;
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

-- Future functions. Revoke and grant must stay paired per grantor: revoking for
-- postgres without granting would leave functions it creates later with no
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

-- The block above no-ops when the runner is postgres and silently fails when it
-- is an unrelated role; a NOTICE cannot tell them apart. Assert the end state.
-- Only covers grantors that already have a pg_default_acl entry — a role with
-- none falls back to the built-in PUBLIC grant, but the revokes above cover
-- every role that creates functions here.
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
      a.grantee = 0
      or a.grantee = to_regrole('anon')::oid
      or a.grantee = to_regrole('authenticated')::oid
    );

  if leaked > 0 then
    raise exception
      'default privileges still grant EXECUTE to PUBLIC/anon/authenticated in % entr(ies)', leaked;
  end if;
end;
$$;
