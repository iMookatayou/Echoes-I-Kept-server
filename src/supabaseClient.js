import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.API_URL || process.env.SUPABASE_URL
const supabaseServiceRoleKey =
  process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

function isValidHttpUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function hasSupabaseConfig() {
  return Boolean(isValidHttpUrl(supabaseUrl) && supabaseServiceRoleKey)
}

export function isLocalSupabaseConfig() {
  if (!isValidHttpUrl(supabaseUrl)) return false
  const { hostname } = new URL(supabaseUrl)
  return hostname === '127.0.0.1' || hostname === 'localhost'
}

export const supabase = hasSupabaseConfig()
  ? createClient(supabaseUrl, supabaseServiceRoleKey)
  : null
