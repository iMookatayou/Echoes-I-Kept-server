import { supabase } from '../supabaseClient.js'
import { requireDatabase, throwDatabaseError } from '../utils/dbErrors.js'

const commentSelection = `
  id,
  post_id,
  user_id,
  comment_text,
  created_at,
  user:users(username, first_name, last_name, profile_pic)
`

function toComment(row) {
  const user = row.user
  const authorName = user
    ? [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username
    : null

  return {
    id: row.id,
    postId: row.post_id,
    userId: row.user_id,
    commentText: row.comment_text,
    createdAt: row.created_at,
    authorName,
    authorAvatar: user?.profile_pic || null,
  }
}

export async function listByPostId(postId) {
  requireDatabase()
  const { data, error } = await supabase
    .from('comments')
    .select(commentSelection)
    .eq('post_id', postId)
    .order('created_at', { ascending: true })

  throwDatabaseError(error)
  return (data || []).map(toComment)
}

export async function create({ postId, userId, commentText }) {
  requireDatabase()
  const { data, error } = await supabase
    .from('comments')
    .insert({ post_id: postId, user_id: userId, comment_text: commentText })
    .select(commentSelection)
    .single()

  throwDatabaseError(error)
  return toComment(data)
}

export async function getById(id) {
  requireDatabase()
  const { data, error } = await supabase
    .from('comments')
    .select('id, post_id, user_id')
    .eq('id', id)
    .maybeSingle()

  throwDatabaseError(error)
  return data ? { id: data.id, postId: data.post_id, userId: data.user_id } : null
}

export async function remove(id) {
  requireDatabase()
  const { data, error } = await supabase
    .from('comments')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle()

  throwDatabaseError(error)
  return Boolean(data)
}
