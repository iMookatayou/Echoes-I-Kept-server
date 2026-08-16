import { supabase } from '../supabaseClient.js'
import { requireDatabase, throwDatabaseError } from '../utils/dbErrors.js'

export async function create({ userId, tokenHash, expiresAt }) {
  requireDatabase()
  const { error } = await supabase
    .from('password_reset_tokens')
    .insert({
      user_id: userId,
      token_hash: tokenHash,
      expires_at: expiresAt.toISOString(),
    })

  throwDatabaseError(error)
}

export async function findActiveByHash(hash) {
  requireDatabase()
  const { data, error } = await supabase
    .from('password_reset_tokens')
    .select('id, user_id, expires_at')
    .eq('token_hash', hash)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  throwDatabaseError(error)
  return data || null
}

export async function markUsed(id) {
  requireDatabase()
  const { error } = await supabase
    .from('password_reset_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('id', id)
    .is('used_at', null)

  throwDatabaseError(error)
}

// Called when a new reset is requested, so only the most recently emailed
// link ever works — an old email sitting in an inbox (or a previous request
// the user gave up on) can't be used once a newer one has been issued.
export async function invalidateActiveForUser(userId) {
  requireDatabase()
  const { error } = await supabase
    .from('password_reset_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('used_at', null)

  throwDatabaseError(error)
}
