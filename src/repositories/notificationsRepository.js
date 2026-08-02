import { supabase } from '../supabaseClient.js'
import { requireDatabase, throwDatabaseError } from '../utils/dbErrors.js'

const notificationSelection = `
  id,
  user_id,
  type,
  status,
  actor_name,
  actor_avatar,
  action,
  message,
  article_id,
  article_title,
  created_at
`

function toNotification(row) {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    status: row.status,
    actorName: row.actor_name,
    actorAvatar: row.actor_avatar,
    action: row.action,
    message: row.message,
    articleId: row.article_id,
    articleTitle: row.article_title,
    createdAt: row.created_at,
  }
}

export async function listByUserId(userId) {
  requireDatabase()
  const { data, error } = await supabase
    .from('notifications')
    .select(notificationSelection)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  throwDatabaseError(error)
  return (data || []).map(toNotification)
}

export async function create({
  userId,
  type,
  actorName,
  actorAvatar,
  action,
  message,
  articleId,
  articleTitle,
}) {
  requireDatabase()
  const { data, error } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      type,
      actor_name: actorName || null,
      actor_avatar: actorAvatar || null,
      action,
      message: message || null,
      article_id: articleId || null,
      article_title: articleTitle || null,
    })
    .select(notificationSelection)
    .single()

  throwDatabaseError(error)
  return toNotification(data)
}

export async function markAsRead(id, userId) {
  requireDatabase()
  const { data, error } = await supabase
    .from('notifications')
    .update({ status: 'read' })
    .eq('id', id)
    .eq('user_id', userId)
    .select(notificationSelection)
    .maybeSingle()

  throwDatabaseError(error)
  return data ? toNotification(data) : null
}

export async function markAllAsRead(userId) {
  requireDatabase()
  const { error } = await supabase
    .from('notifications')
    .update({ status: 'read' })
    .eq('user_id', userId)
    .eq('status', 'unread')

  throwDatabaseError(error)
}
