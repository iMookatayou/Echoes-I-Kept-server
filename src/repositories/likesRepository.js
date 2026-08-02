import { supabase } from '../supabaseClient.js'
import { requireDatabase, throwDatabaseError } from '../utils/dbErrors.js'
import { HttpError } from '../utils/httpError.js'

export async function create({ postId, userId }) {
  requireDatabase()
  const { error } = await supabase
    .from('likes')
    .insert({ post_id: postId, user_id: userId })

  if (error?.code === '23505') {
    throw new HttpError(409, 'ALREADY_LIKED', 'You have already liked this post')
  }
  throwDatabaseError(error)
}

export async function remove({ postId, userId }) {
  requireDatabase()
  const { data, error } = await supabase
    .from('likes')
    .delete()
    .eq('post_id', postId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle()

  throwDatabaseError(error)
  return Boolean(data)
}

export async function exists({ postId, userId }) {
  requireDatabase()
  const { data, error } = await supabase
    .from('likes')
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .maybeSingle()

  throwDatabaseError(error)
  return Boolean(data)
}
