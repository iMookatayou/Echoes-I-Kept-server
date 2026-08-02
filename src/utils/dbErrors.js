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

  // Raised by the posts_enforce_pending_submission_cap trigger, which is the
  // race-proof backstop behind the controller's own cap check.
  if (error.message?.includes('SUBMISSION_LIMIT')) {
    throw new HttpError(
      429,
      'SUBMISSION_LIMIT',
      'You already have the maximum number of posts awaiting review',
    )
  }

  if (error.code === '23505') {
    throw new HttpError(409, 'CONFLICT', 'A record with this value already exists')
  }

  if (error.code === '23503') {
    throw new HttpError(400, 'INVALID_REFERENCE', 'A related record is invalid')
  }

  throw new HttpError(500, 'DATABASE_ERROR', error.message)
}
