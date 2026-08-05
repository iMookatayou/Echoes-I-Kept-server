import { supabase } from '../supabaseClient.js'
import { requireDatabase, throwDatabaseError } from '../utils/dbErrors.js'

export async function create({ userId, purpose, codeHash, expiresAt }) {
  requireDatabase()
  const { data, error } = await supabase
    .from('email_otps')
    .insert({
      user_id: userId,
      purpose,
      code_hash: codeHash,
      expires_at: expiresAt.toISOString(),
    })
    .select('id, created_at')
    .single()

  throwDatabaseError(error)
  return data
}

export async function findActiveByUserAndPurpose(userId, purpose) {
  requireDatabase()
  const { data, error } = await supabase
    .from('email_otps')
    .select('id, code_hash, expires_at, attempt_count, created_at')
    .eq('user_id', userId)
    .eq('purpose', purpose)
    .is('consumed_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  throwDatabaseError(error)
  return data || null
}

export async function invalidateActiveForUserAndPurpose(userId, purpose) {
  requireDatabase()
  const { error } = await supabase
    .from('email_otps')
    .update({ consumed_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('purpose', purpose)
    .is('consumed_at', null)

  throwDatabaseError(error)
}

export async function incrementAttempts(id) {
  requireDatabase()
  const { error } = await supabase.rpc('increment_otp_attempts', { target_otp_id: id })
  throwDatabaseError(error)
}

export async function consume(id) {
  requireDatabase()
  const { error } = await supabase
    .from('email_otps')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', id)
    .is('consumed_at', null)

  throwDatabaseError(error)
}
