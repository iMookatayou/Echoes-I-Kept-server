-- Companion to 202608090004, extended from functions to tables and
-- sequences. A full structural audit (pg_default_acl, has_table_privilege,
-- has_sequence_privilege against the actual applied database) found two
-- more defaults inherited from the `postgres` grantor — the role migrations
-- run as — that are broader than they need to be:
--
--   1. Every table in `public` grants TRUNCATE, REFERENCES, TRIGGER, and
--      MAINTAIN to anon/authenticated. TRUNCATE bypasses row-level security
--      entirely — RLS-with-no-policies (the posture on every table here)
--      blocks SELECT/INSERT/UPDATE/DELETE but does nothing against it.
--   2. Every bigint-PK sequence (posts_id_seq, categories_id_seq,
--      comments_id_seq, likes_id_seq) grants UPDATE to anon/authenticated —
--      UPDATE on a sequence is what setval() requires.
--
-- Neither is reachable through PostgREST's normal surface today: REST
-- endpoints only ever issue SELECT/INSERT/UPDATE/DELETE gated by RLS, and
-- RPC only calls functions — none of which are anon-executable (see
-- 202608090002-04). Actually invoking TRUNCATE or setval needs a real SQL
-- session authenticated as that role, which anon/authenticated don't have
-- outside PostgREST's own connection pool. This is a least-privilege
-- cleanup, not a fix for a currently-open hole — but it closes a gap a
-- future anon-exposed function could otherwise fall into silently: a
-- function that calls TRUNCATE or setval would work today specifically
-- because these grants are still standing.

-- Existing tables/sequences. Same ownership guard as 202608090004's
-- function loop, extended to relations: revoking is filtered to objects
-- this role can act as grantor for, and anything outside that is counted
-- and raised on rather than silently left untouched (REVOKE without grant
-- option only warns and continues — the exact "reports success while
-- leaving the grant in place" failure 202608090002 exists to avoid).
do $$
declare
  rel record;
  unowned int;
begin
  select count(*) into unowned
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'S')
    and not exists (
      select 1 from pg_depend d
      where d.objid = c.oid and d.classid = 'pg_class'::regclass and d.deptype = 'e'
    )
    and not pg_has_role(c.relowner, 'USAGE');

  if unowned > 0 then
    raise exception
      'cannot revoke privileges on % public relation(s) owned by an unrelated role', unowned;
  end if;

  for rel in
    select c.oid, c.relname, c.relkind
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'S')
      and not exists (
        select 1 from pg_depend d
        where d.objid = c.oid and d.classid = 'pg_class'::regclass and d.deptype = 'e'
      )
  loop
    if rel.relkind = 'r' then
      execute format(
        'revoke truncate, references, trigger, maintain on table public.%I from anon, authenticated',
        rel.relname
      );
    else
      execute format(
        'revoke update on sequence public.%I from anon, authenticated',
        rel.relname
      );
    end if;
  end loop;
end;
$$;

-- Future tables/sequences created by the role running migrations.
alter default privileges in schema public
  revoke truncate, references, trigger, maintain on tables from anon, authenticated;
alter default privileges in schema public
  revoke update on sequences from anon, authenticated;

-- Same for `postgres` specifically, when the migration runner differs from
-- it (Supabase's bootstrap registers its own grant under postgres). Skipped
-- rather than raised on failure, for the same reason as 202608090004: an
-- abort here would leave this migration unrecorded and every later db push
-- would retry and fail identically.
do $$
begin
  alter default privileges for role postgres in schema public
    revoke truncate, references, trigger, maintain on tables from anon, authenticated;
  alter default privileges for role postgres in schema public
    revoke update on sequences from anon, authenticated;
exception
  when insufficient_privilege or undefined_object then
    raise notice 'skipped default privileges for role postgres: %', sqlerrm;
end;
$$;

-- Assert the end state on existing objects rather than trust the loop above
-- ran cleanly on every one.
do $$
declare
  leaked text;
begin
  select string_agg(c.relname, ', ')
  into leaked
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and (
      has_table_privilege('anon', c.oid, 'TRUNCATE')
      or has_table_privilege('authenticated', c.oid, 'TRUNCATE')
      or has_table_privilege('anon', c.oid, 'REFERENCES')
      or has_table_privilege('authenticated', c.oid, 'REFERENCES')
      or has_table_privilege('anon', c.oid, 'TRIGGER')
      or has_table_privilege('authenticated', c.oid, 'TRIGGER')
      or has_table_privilege('anon', c.oid, 'MAINTAIN')
      or has_table_privilege('authenticated', c.oid, 'MAINTAIN')
    );

  if leaked is not null then
    raise exception
      'TRUNCATE/REFERENCES/TRIGGER/MAINTAIN still granted to anon/authenticated on: %', leaked;
  end if;
end;
$$;

do $$
declare
  leaked text;
begin
  select string_agg(c.relname, ', ')
  into leaked
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'S'
    and (
      has_sequence_privilege('anon', c.oid, 'UPDATE')
      or has_sequence_privilege('authenticated', c.oid, 'UPDATE')
    );

  if leaked is not null then
    raise exception 'UPDATE still granted to anon/authenticated on sequence(s): %', leaked;
  end if;
end;
$$;
