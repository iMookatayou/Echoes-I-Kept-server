import { supabase } from '../supabaseClient.js'
import { requireDatabase, throwDatabaseError } from '../utils/dbErrors.js'

export async function getCachedTranslation(postId, language) {
  requireDatabase()
  const { data, error } = await supabase
    .from('post_translations')
    .select('title, description, content')
    .eq('post_id', postId)
    .eq('language', language)
    .maybeSingle()

  throwDatabaseError(error)
  return data
}

// Upsert rather than insert: a translation can already exist from a request
// that raced this one (two readers hitting an uncached post at once), and
// the unique (post_id, language) constraint would otherwise turn the second
// writer's cache-fill into a hard error after it already paid for the call.
export async function saveTranslation(postId, language, { title, description, content }) {
  requireDatabase()
  const { error } = await supabase
    .from('post_translations')
    .upsert(
      { post_id: postId, language, title, description, content },
      { onConflict: 'post_id,language' },
    )

  throwDatabaseError(error)
}
