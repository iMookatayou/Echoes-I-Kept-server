-- Caches AI-translated (title, description, content) per post per language.
-- Translation is reader-facing and reachable by every visitor to a popular
-- post, unlike the writer-assist AI endpoints (polish/presubmit/moderate)
-- which are each called once per draft by their own author. Without a cache,
-- every reader clicking "translate" on the same post would re-pay Gemini for
-- an identical result — this table makes the very first request for a given
-- (post, language) pair the only one that ever costs anything.
create table public.post_translations (
  id bigint generated always as identity primary key,
  post_id bigint not null references public.posts(id) on delete cascade,
  language text not null check (language in ('en', 'th')),
  title text not null,
  description text not null,
  content text not null,
  created_at timestamptz not null default current_timestamp,
  unique (post_id, language)
);

-- Invalidates a cached translation when the post itself changes, so an edit
-- doesn't leave a stale translation being served indefinitely. Simpler than
-- tracking a source-content hash: any update clears both language rows, and
-- the next translate request just repopulates the one actually asked for.
create or replace function public.clear_post_translations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.post_translations where post_id = old.id;
  return new;
end;
$$;

create trigger posts_clear_translations_on_update
  after update of title, description, content on public.posts
  for each row
  when (old.title is distinct from new.title
    or old.description is distinct from new.description
    or old.content is distinct from new.content)
  execute function public.clear_post_translations();

alter table public.post_translations enable row level security;

grant select, insert, update, delete on public.post_translations to service_role;
grant usage, select on sequence public.post_translations_id_seq to service_role;
