-- Authors had no way to say what they write about. posts.author_bio has
-- existed since the original schema, but nothing ever populated it except
-- the seed data — createPost hardcoded authorBio: [] for every real post,
-- so AuthorSidebar's bio only ever showed for the 6 seed articles.
--
-- Same shape as posts.author_bio (text[], one entry per paragraph) so the
-- snapshot-on-create logic being added alongside this migration is a
-- straight copy, no reshaping.
alter table public.users
  add column bio text[] not null default '{}';
