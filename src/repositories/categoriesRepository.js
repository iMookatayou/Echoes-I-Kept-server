import { supabase } from '../supabaseClient.js'
import { HttpError } from '../utils/httpError.js'
import { requireDatabase, throwDatabaseError } from '../utils/dbErrors.js'
import { toSlug } from '../utils/slug.js'

const categorySelection = 'id, name, slug, created_at, updated_at'

function toCategory(row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listCategories() {
  requireDatabase()
  const { data, error } = await supabase
    .from('categories')
    .select(categorySelection)
    .order('id', { ascending: true })

  throwDatabaseError(error)
  return (data || []).map(toCategory)
}

export async function getCategoryById(id) {
  requireDatabase()
  const { data, error } = await supabase
    .from('categories')
    .select(categorySelection)
    .eq('id', id)
    .maybeSingle()

  throwDatabaseError(error)
  return data ? toCategory(data) : null
}

export async function createCategory({ name }) {
  requireDatabase()
  const { data, error } = await supabase
    .from('categories')
    .insert({ name, slug: toSlug(name) })
    .select(categorySelection)
    .single()

  throwDatabaseError(error)
  return toCategory(data)
}

export async function updateCategory(id, { name }) {
  requireDatabase()
  const { data, error } = await supabase
    .from('categories')
    .update({ name, slug: toSlug(name) })
    .eq('id', id)
    .select(categorySelection)
    .maybeSingle()

  throwDatabaseError(error)
  return data ? toCategory(data) : null
}

export async function deleteCategory(id) {
  requireDatabase()
  const { data, error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (error?.code === '23503') {
    throw new HttpError(
      409,
      'CATEGORY_IN_USE',
      'This category is used by existing posts and cannot be deleted',
    )
  }
  throwDatabaseError(error)

  return Boolean(data)
}
