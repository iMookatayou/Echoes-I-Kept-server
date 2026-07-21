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
  author_name,
  author_avatar_url,
  author_bio,
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
    author: row.author_name,
    authorAvatar: row.author_avatar_url,
    authorBio: row.author_bio || [],
    date: (row.published_at || row.created_at).slice(0, 10),
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

function toPostRow(payload, categoryId, existingPublishedAt = null) {
  const publishedAt =
    payload.status === 'published'
      ? payload.publishedAt || existingPublishedAt || new Date().toISOString()
      : null

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
    author_name: payload.authorName,
    author_avatar_url: payload.authorAvatar || null,
    author_bio: payload.authorBio,
    published_at: publishedAt,
  }
}

export async function listPosts({ page, limit, status, category, search }) {
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

export async function createPost(payload) {
  requireDatabase()
  const category = await findCategory(payload.category)
  const { data, error } = await supabase
    .from('posts')
    .insert(toPostRow(payload, category.id))
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
    .update(toPostRow(payload, category.id, existingPost.publishedAt))
    .eq('id', id)
    .select(postSelection)
    .maybeSingle()

  throwDatabaseError(error)
  return data ? toPost(data) : null
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
