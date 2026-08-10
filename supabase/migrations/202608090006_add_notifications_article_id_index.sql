-- notifications.article_id has an ON DELETE SET NULL foreign key to posts(id),
-- and posts are hard-deleted (deletePost() in postsRepository.js issues a real
-- DELETE, unlike users which are only ever soft-deleted via is_active). Every
-- post deletion makes Postgres scan notifications for rows to null out; with
-- no index that's a full table scan, on every delete, that gets slower as
-- notifications grows. The column is never filtered on directly by app code —
-- this index exists purely to bound that FK-enforcement cost.
create index if not exists notifications_article_id_idx on public.notifications (article_id);
