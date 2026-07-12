import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

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
