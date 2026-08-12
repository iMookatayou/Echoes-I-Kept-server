import { supabase } from '../supabaseClient.js'
import { requireDatabase, throwDatabaseError } from '../utils/dbErrors.js'

// Atomically claims one request against the user's daily allowance.
// Returns { allowed, used, chargedDate } — call it before hitting the Gemini
// API, never after, so a rejected caller never costs anything. chargedDate is
// the date the row was actually written against; pass it back to refundQuota
// so a refund that lands after UTC midnight still targets the row that was
// charged rather than the new day's.
export async function consumeQuota(userId, dailyLimit, category) {
  requireDatabase()
  const { data, error } = await supabase.rpc('consume_ai_quota', {
    target_user_id: userId,
    daily_limit: dailyLimit,
    target_category: category,
  })

  throwDatabaseError(error)

  const row = Array.isArray(data) ? data[0] : data
  return {
    allowed: Boolean(row?.allowed),
    used: row?.used ?? 0,
    // undefined, not null: supabase-js omits undefined keys, so a DB still on
    // the pre-202608090001 functions (deployed before db:push) falls through
    // to the zero-/one-arg refund wrappers that default to current_date.
    // Sending null instead would either miss the overload entirely or run
    // `where usage_date = NULL`, silently refunding nothing.
    chargedDate: row?.charged_date ?? undefined,
  }
}

// Hands back a slot claimed by consumeQuota() when the call it was reserved
// for never reached the model — a transport failure, not a real attempt.
export async function refundQuota(userId, chargedDate, category) {
  requireDatabase()
  // The key is omitted rather than sent as null when the date is unknown —
  // that's what selects the one-arg wrapper, which defaults to current_date
  // and the 'writing_assist' category.
  const { error } = await supabase.rpc('refund_ai_quota', {
    target_user_id: userId,
    ...(chargedDate ? { target_date: chargedDate, target_category: category } : {}),
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
    // undefined, not null: supabase-js omits undefined keys, so a DB still on
    // the pre-202608090001 functions (deployed before db:push) falls through
    // to the zero-/one-arg refund wrappers that default to current_date.
    // Sending null instead would either miss the overload entirely or run
    // `where usage_date = NULL`, silently refunding nothing.
    chargedDate: row?.charged_date ?? undefined,
  }
}

export async function refundGlobalQuota(chargedDate) {
  requireDatabase()
  // Same as refundQuota: no key means the zero-arg wrapper, not a null date.
  const { error } = await supabase.rpc(
    'refund_global_ai_quota',
    chargedDate ? { target_date: chargedDate } : {},
  )
  throwDatabaseError(error)
}
