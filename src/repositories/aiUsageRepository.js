import { supabase } from '../supabaseClient.js'
import { requireDatabase, throwDatabaseError } from '../utils/dbErrors.js'

// Atomically claims one request against the user's daily allowance.
// Returns { allowed, used, chargedDate } — call it before hitting the Gemini
// API, never after, so a rejected caller never costs anything. chargedDate is
// the date the row was actually written against; pass it back to refundQuota
// so a refund that lands after UTC midnight still targets the row that was
// charged rather than the new day's.
export async function consumeQuota(userId, dailyLimit) {
  requireDatabase()
  const { data, error } = await supabase.rpc('consume_ai_quota', {
    target_user_id: userId,
    daily_limit: dailyLimit,
  })

  throwDatabaseError(error)

  const row = Array.isArray(data) ? data[0] : data
  return {
    allowed: Boolean(row?.allowed),
    used: row?.used ?? 0,
    chargedDate: row?.charged_date ?? null,
  }
}

// Hands back a slot claimed by consumeQuota() when the call it was reserved
// for never reached the model — a transport failure, not a real attempt.
export async function refundQuota(userId, chargedDate) {
  requireDatabase()
  const { error } = await supabase.rpc('refund_ai_quota', {
    target_user_id: userId,
    target_date: chargedDate,
  })
  throwDatabaseError(error)
}

// Same as consumeQuota, but for the site-wide daily budget — Gemini's free
// tier caps requests per project per model per day, shared across every user
// and every one of the three AI endpoints. Check this first: no point
// spending a user's personal allowance on a call the site's shared budget
// won't allow anyway.
export async function consumeGlobalQuota(dailyLimit) {
  requireDatabase()
  const { data, error } = await supabase.rpc('consume_global_ai_quota', {
    daily_limit: dailyLimit,
  })

  throwDatabaseError(error)

  const row = Array.isArray(data) ? data[0] : data
  return {
    allowed: Boolean(row?.allowed),
    used: row?.used ?? 0,
    chargedDate: row?.charged_date ?? null,
  }
}

export async function refundGlobalQuota(chargedDate) {
  requireDatabase()
  const { error } = await supabase.rpc('refund_global_ai_quota', {
    target_date: chargedDate,
  })
  throwDatabaseError(error)
}
