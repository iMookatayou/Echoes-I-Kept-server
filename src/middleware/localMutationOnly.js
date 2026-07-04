import { HttpError } from '../utils/httpError.js'
import { isLocalSupabaseConfig } from '../supabaseClient.js'

export function localMutationOnly(_req, _res, next) {
  if (!isLocalSupabaseConfig()) {
    return next(
      new HttpError(
        403,
        'MUTATION_DISABLED',
        'Post mutations require local Supabase until backend authentication is available',
      ),
    )
  }

  return next()
}
