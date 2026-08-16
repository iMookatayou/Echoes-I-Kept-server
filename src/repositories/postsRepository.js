import { supabase } from '../supabaseClient.js'
import { HttpError } from '../utils/httpError.js'
import { requireDatabase, throwDatabaseError } from '../utils/dbErrors.js'
import { toSlug } from '../utils/slug.js'

const postSelection = `
  id,
  artist,
  best_pick,
  spotify_url,
  image_url,
  detail_image_url,
  detail_image_position,
  title,
  description,
  content,
  status,
  author_id,
  author_name,
  author_avatar_url,
  author_bio,
  likes_count,
  rejection_reason,
  moderated_by,
  moderated_at,
  first_published_at,
  published_at,
  created_at,
  updated_at,
  category:categories!inner(name, slug)
`

function sanitizeSearch(value) {
  return value.replace(/[,%()]/g, ' ').trim()
}

function toPost(row) {
  return {
    id: row.id,
    artist: row.artist,
    bestPick: row.best_pick,
    spotifyUrl: row.spotify_url,
    image: row.image_url,
    detailImage: row.detail_image_url,
    detailImagePosition: row.detail_image_position,
    category: row.category?.name || null,
    categorySlug: row.category?.slug || null,
    title: row.title,
    description: row.description,
    content: row.content,
    status: row.status,
    authorId: row.author_id,
    author: row.author_name,
    authorAvatar: row.author_avatar_url,
    authorBio: row.author_bio || [],
    likesCount: row.likes_count,
    rejectionReason: row.rejection_reason,
    moderatedBy: row.moderated_by,
    moderatedAt: row.moderated_at,
    firstPublishedAt: row.first_published_at,
    date: (row.first_published_at || row.published_at || row.created_at).slice(0, 10),
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function findCategory(category) {
  requireDatabase()
  const slug = toSlug(category)
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, slug')
    .eq('slug', slug)
    .maybeSingle()

  throwDatabaseError(error)

  if (!data) {
    throw new HttpError(400, 'UNKNOWN_CATEGORY', `Category "${category}" does not exist`)
  }

  return data
}

// Author identity is only ever taken from `payload` on create. On update,
// `existingPost`'s author fields are carried forward untouched regardless of
// what's in `payload` — updatePostSchema doesn't even accept author fields
// (see postSchema.js), so an admin editing someone else's post can never
// overwrite its byline.
function toPostRow(payload, categoryId, existingPost = null) {
  const now = new Date().toISOString()
  const publishedAt =
    payload.status === 'published'
      ? payload.publishedAt || existingPost?.publishedAt || now
      : null

  // Stamped the first time a post goes live and never cleared afterwards, so
  // reverting to pending for a re-review doesn't lose the original date — and
  // so it stays correct even when an admin publishes via a plain edit rather
  // than the approve endpoint.
  const firstPublishedAt =
    existingPost?.firstPublishedAt || (payload.status === 'published' ? now : null)

  // A rejection is a verdict on specific content, so it stops applying once
  // that content is edited — but an admin editing a post that stays rejected
  // should keep the reason the author is being shown.
  const keepsRejection = payload.status === 'rejected'

  return {
    category_id: categoryId,
    artist: payload.artist || null,
    best_pick: payload.bestPick || null,
    spotify_url: payload.spotifyUrl || null,
    image_url: payload.image,
    detail_image_url: payload.detailImage || null,
    detail_image_position: payload.detailImagePosition,
    title: payload.title,
    description: payload.description,
    content: payload.content,
    status: payload.status,
    author_name: existingPost ? existingPost.author : payload.authorName,
    author_avatar_url: existingPost ? existingPost.authorAvatar : payload.authorAvatar || null,
    author_bio: existingPost ? existingPost.authorBio : payload.authorBio,
    published_at: publishedAt,
    first_published_at: firstPublishedAt,
    rejection_reason: keepsRejection ? existingPost?.rejectionReason ?? null : null,
    // A resubmission is awaiting a fresh verdict — don't keep advertising the
    // previous moderator/timestamp on it.
    moderated_by: keepsRejection ? existingPost?.moderatedBy ?? null : null,
    moderated_at: keepsRejection ? existingPost?.moderatedAt ?? null : null,
  }
}

export async function listPosts({ page, limit, status, category, search, authorId }) {
  requireDatabase()
  const from = (page - 1) * limit
  const to = from + limit - 1
  let query = supabase
    .from('posts')
    .select(postSelection, { count: 'exact' })
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (status !== 'all') query = query.eq('status', status)
  if (authorId) query = query.eq('author_id', authorId)
  if (category) query = query.eq('categories.slug', toSlug(category))

  const cleanSearch = search ? sanitizeSearch(search) : ''
  if (cleanSearch) {
    const pattern = `%${cleanSearch}%`
    query = query.or(
      `title.ilike.${pattern},description.ilike.${pattern},artist.ilike.${pattern},best_pick.ilike.${pattern}`,
    )
  }

  const { data, error, count } = await query
  throwDatabaseError(error)

  return {
    posts: (data || []).map(toPost),
    total: count || 0,
  }
}

export async function getPostById(id) {
  requireDatabase()
  const { data, error } = await supabase
    .from('posts')
    .select(postSelection)
    .eq('id', id)
    .maybeSingle()

  throwDatabaseError(error)
  return data ? toPost(data) : null
}

export async function createPost(payload, authorId) {
  requireDatabase()
  const category = await findCategory(payload.category)
  const { data, error } = await supabase
    .from('posts')
    .insert({ ...toPostRow(payload, category.id), author_id: authorId })
    .select(postSelection)
    .single()

  throwDatabaseError(error)
  return toPost(data)
}

export async function updatePost(id, payload) {
  requireDatabase()
  const existingPost = await getPostById(id)
  if (!existingPost) return null

  const category = await findCategory(payload.category)
  const { data, error } = await supabase
    .from('posts')
    .update(toPostRow(payload, category.id, existingPost))
    .eq('id', id)
    .select(postSelection)
    .maybeSingle()

  throwDatabaseError(error)
  return data ? toPost(data) : null
}

// Minimal partial update for moderation actions — deliberately bypasses
// toPostRow/findCategory, which assume a full content payload and would
// either 400 (no category in the payload) or null out title/content/image
// if reused for a status-only change.
export async function updatePostModeration(
  id,
  { status, rejectionReason, moderatedBy, publishedAt, firstPublishedAt },
) {
  requireDatabase()
  const { data, error } = await supabase
    .from('posts')
    .update({
      status,
      rejection_reason: rejectionReason ?? null,
      moderated_by: moderatedBy,
      moderated_at: new Date().toISOString(),
      published_at: publishedAt ?? null,
      first_published_at: firstPublishedAt ?? null,
    })
    .eq('id', id)
    .select(postSelection)
    .maybeSingle()

  throwDatabaseError(error)
  return data ? toPost(data) : null
}

export async function countByAuthorAndStatus(authorId, status) {
  requireDatabase()
  const { count, error } = await supabase
    .from('posts')
    .select('id', { count: 'exact', head: true })
    .eq('author_id', authorId)
    .eq('status', status)

  throwDatabaseError(error)
  return count || 0
}

export async function deletePost(id) {
  requireDatabase()
  const { data, error } = await supabase
    .from('posts')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle()

  throwDatabaseError(error)
  return Boolean(data)
}
