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
-- later would abort this on every db reset. Extension-owned functions are
-- skipped — not ours to re-permission. The classid predicate matters because
-- pg_depend.objid is only unique per catalog, not globally.
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
        where d.objid = p.oid
          and d.classid = 'pg_proc'::regclass
          and d.deptype = 'e'
      )
  loop
    execute format('revoke execute on routine %s from public, anon, authenticated', fn.sig);
    execute format('grant execute on routine %s to service_role', fn.sig);
  end loop;
end;
$$;

-- REVOKE only strips ACL entries whose grantor is this role, and warns rather
-- than errors otherwise — so the loop can report success having changed
-- nothing. Assert the end state instead, which is grantor-agnostic and catches
-- that regardless of who granted or owns what.
do $$
declare
  leaked text;
begin
  select string_agg(p.oid::regprocedure::text, ', ')
  into leaked
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  cross join lateral aclexplode(p.proacl) a
  where n.nspname = 'public'
    and not exists (
      select 1 from pg_depend d
      where d.objid = p.oid
        and d.classid = 'pg_proc'::regclass
        and d.deptype = 'e'
    )
    and a.privilege_type = 'EXECUTE'
    and (
      a.grantee = 0
      or a.grantee = to_regrole('anon')::oid
      or a.grantee = to_regrole('authenticated')::oid
    );

  if leaked is not null then
    raise exception 'EXECUTE still granted to PUBLIC/anon/authenticated on: %', leaked;
  end if;
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

-- Scoped to the two grantors above, deliberately. Supabase's bootstrap also
-- records an unqualified entry under whichever superuser ran init
-- (supabase_admin on the stock image); that entry is not ours to change, and
-- asserting over every grantor would raise on it, abort the transaction, and
-- leave this migration unrecorded — so every later db push would retry and
-- fail the same way.
do $$
declare
  leaked text;
begin
  select string_agg(distinct d.defaclrole::regrole::text, ', ')
  into leaked
  from pg_default_acl d
  join pg_namespace n on n.oid = d.defaclnamespace
  cross join lateral aclexplode(d.defaclacl) a
  where n.nspname = 'public'
    and d.defaclobjtype = 'f'
    and d.defaclrole in (to_regrole(current_user)::oid, to_regrole('postgres')::oid)
    and a.privilege_type = 'EXECUTE'
    and (
      a.grantee = 0
      or a.grantee = to_regrole('anon')::oid
      or a.grantee = to_regrole('authenticated')::oid
    );

  if leaked is not null then
    raise exception
      'default privileges for % still grant EXECUTE to PUBLIC/anon/authenticated', leaked;
  end if;

  -- The guarded block above cannot tell "redundant because we are postgres"
  -- from "skipped because we are not". The check above passes trivially in the
  -- skipped case, since an entry that was never created holds nothing. Warn
  -- rather than raise: functions postgres creates later would be born
  -- PUBLIC-executable, but aborting here would leave the migration unrecorded
  -- and permanently unappliable, which is worse.
  if to_regrole('postgres') is not null
     and to_regrole(current_user)::oid <> to_regrole('postgres')::oid
     and not exists (
       select 1 from pg_default_acl d
       join pg_namespace n on n.oid = d.defaclnamespace
       where n.nspname = 'public'
         and d.defaclobjtype = 'f'
         and d.defaclrole = to_regrole('postgres')::oid
     )
  then
    raise warning
      'no default privileges recorded for postgres in schema public; functions it creates later will be anon-callable. Run as postgres: alter default privileges in schema public revoke execute on functions from public, anon, authenticated;';
  end if;
end;
$$;
