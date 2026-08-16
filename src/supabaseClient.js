import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.API_URL || process.env.SUPABASE_URL
// Supabase's newer sb_secret_... key format supersedes the legacy JWT
// service_role key — a project can have legacy keys disabled entirely, in
// which case SUPABASE_SERVICE_ROLE_KEY still exists as an env var but is
// rejected by every Supabase API call with "Invalid API key". Prefer the
// new key when present; fall back to the legacy one for projects that
// still have it enabled.
const supabaseServiceRoleKey =
  process.env.SECRET_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY

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

export const supabase = hasSupabaseConfig()
  ? createClient(supabaseUrl, supabaseServiceRoleKey)
  : null
