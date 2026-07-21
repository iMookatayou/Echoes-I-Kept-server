import { supabase } from '../supabaseClient.js'
import { requireDatabase, throwDatabaseError } from '../utils/dbErrors.js'

export async function create({ userId, tokenHash, expiresAt }) {
  requireDatabase()
  const { data, error } = await supabase
    .from('refresh_tokens')
    .insert({
      user_id: userId,
      token_hash: tokenHash,
      expires_at: expiresAt.toISOString(),
    })
    .select('id')
    .single()

  throwDatabaseError(error)
  return data.id
}

export async function findActiveByHash(hash) {
  requireDatabase()
  const { data, error } = await supabase
    .from('refresh_tokens')
    .select('id, user_id, expires_at, revoked_at')
    .eq('token_hash', hash)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  throwDatabaseError(error)
  return data || null
}

export async function revoke(id) {
  requireDatabase()
  const { error } = await supabase
    .from('refresh_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .is('revoked_at', null)

  throwDatabaseError(error)
}

export async function revokeByHash(hash) {
  requireDatabase()
  const { error } = await supabase
    .from('refresh_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('token_hash', hash)
    .is('revoked_at', null)

  throwDatabaseError(error)
}

export async function revokeAllForUser(userId) {
  requireDatabase()
  const { error } = await supabase
    .from('refresh_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('revoked_at', null)

  throwDatabaseError(error)
}
