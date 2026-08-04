-- Post content was written as plain text with a numbering convention
-- ("1. About Billie Eilish" on its own line) rather than real markdown, and the
-- client patched it into headings at render time with a regex. That left the
-- content half plain-text, half markdown: anything genuinely markdown an author
-- typed (an image, a link) worked, but their numbered lines silently became
-- ordered-list items instead of headings, the opposite of what the seed posts do.
--
-- Convert the stored content to real markdown once, so there is a single format,
-- and the client-side transform can be deleted. The replacement is the exact
-- transform the client was applying, so rendered output is unchanged.
--
-- Idempotent: the pattern requires a digit immediately after a line start, which
-- "## 1. ..." no longer has, so re-running this is a no-op.
update public.posts
set content = regexp_replace(content, '(^|\n)(\d+\.\s[^\n]+)', '\1## \2', 'g')
where content ~ '(^|\n)\d+\.\s';
