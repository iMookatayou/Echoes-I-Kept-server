import { supabase } from '../supabaseClient.js'
import { HttpError } from './httpError.js'

export function requireDatabase() {
  if (!supabase) {
    throw new HttpError(
      503,
      'DATABASE_NOT_CONFIGURED',
      'Supabase is not configured for the backend',
    )
  }
}

export function throwDatabaseError(error) {
  if (!error) return

  if (error.code === '23505') {
    throw new HttpError(409, 'CONFLICT', 'A record with this value already exists')
  }

  if (error.code === '23503') {
    throw new HttpError(400, 'INVALID_REFERENCE', 'A related record is invalid')
  }

  throw new HttpError(500, 'DATABASE_ERROR', error.message)
}
