-- The 6 seed posts' content had "## " headings but kept a leftover ordinal
-- ("## 1. About X" instead of "## About X"), likely from an earlier partial
-- fix that prepended "## " without removing the original numbered label.
-- Scoped to the known seed ids and guarded by the pattern itself, so this is
-- a no-op if the content has already been fixed or never had the issue.
update public.posts
set content = regexp_replace(content, '## [0-9]+\. ', '## ', 'g')
where id between 1 and 6
  and content ~ '## [0-9]+\. ';
