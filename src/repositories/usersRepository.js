import { supabase } from '../supabaseClient.js'
import { HttpError } from '../utils/httpError.js'
import { requireDatabase, throwDatabaseError } from '../utils/dbErrors.js'
import { defaultAvatarUrl } from '../utils/defaultAvatar.js'

const userSelection =
  'id, email, username, first_name, last_name, role, profile_pic, bio, email_verified, is_active, created_at, updated_at'

const loginSelection = `${userSelection}, password_hash, token_version`

function toUser(row) {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    firstName: row.first_name,
    lastName: row.last_name,
    role: row.role,
    profilePic: row.profile_pic || defaultAvatarUrl(row.first_name, row.last_name),
    bio: row.bio || [],
    emailVerified: row.email_verified,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listUsers() {
  requireDatabase()
  const { data, error } = await supabase
    .from('users')
    .select(userSelection)
    .order('created_at', { ascending: true })

  throwDatabaseError(error)
  return (data || []).map(toUser)
}

export async function getUserById(id) {
  requireDatabase()
  const { data, error } = await supabase
    .from('users')
    .select(userSelection)
    .eq('id', id)
    .maybeSingle()

  throwDatabaseError(error)
  return data ? toUser(data) : null
}

export async function getAuthState(id) {
  requireDatabase()
  const { data, error } = await supabase
    .from('users')
    .select('id, role, token_version, is_active')
    .eq('id', id)
    .maybeSingle()

  throwDatabaseError(error)
  return data
    ? { id: data.id, role: data.role, tokenVersion: data.token_version, isActive: data.is_active }
    : null
}

export async function findUserForLogin(email) {
  requireDatabase()
  const { data, error } = await supabase
    .from('users')
    .select(loginSelection)
    .eq('email', email)
    .maybeSingle()

  throwDatabaseError(error)
  return data || null
}

export async function getUserRowById(id) {
  requireDatabase()
  const { data, error } = await supabase
    .from('users')
    .select(loginSelection)
    .eq('id', id)
    .maybeSingle()

  throwDatabaseError(error)
  return data || null
}

export async function checkUniqueFields({ email, username, excludeId }) {
  requireDatabase()

  const { data: emailMatch, error: emailError } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle()
  throwDatabaseError(emailError)
  if (emailMatch && emailMatch.id !== excludeId) {
    throw new HttpError(409, 'EMAIL_TAKEN', 'Email is already registered')
  }

  const { data: usernameMatch, error: usernameError } = await supabase
    .from('users')
    .select('id')
    .eq('username', username)
    .maybeSingle()
  throwDatabaseError(usernameError)
  if (usernameMatch && usernameMatch.id !== excludeId) {
    throw new HttpError(409, 'USERNAME_TAKEN', 'Username is already taken')
  }
}

export async function createUser({
  firstName,
  lastName,
  username,
  email,
  passwordHash,
  role,
  profilePic,
  emailVerified = true,
}) {
  requireDatabase()
  const { data, error } = await supabase
    .from('users')
    .insert({
      first_name: firstName,
      last_name: lastName || null,
      username,
      email,
      password_hash: passwordHash,
      role,
      profile_pic: profilePic || null,
      email_verified: emailVerified,
    })
    .select(userSelection)
    .single()

  throwDatabaseError(error)
  return toUser(data)
}

export async function updateUser(id, { firstName, lastName, username, email, role, profilePic, bio }) {
  requireDatabase()
  const patch = {
    first_name: firstName,
    last_name: lastName || null,
    username,
    email,
    profile_pic: profilePic || null,
  }
  if (role) patch.role = role
  // Distinct from `if (bio)` on purpose — admin member-management calls
  // don't send bio at all (undefined, leave it alone), but a user clearing
  // their own bio down to an empty array is a deliberate value to save.
  if (bio !== undefined) patch.bio = bio

  const { data, error } = await supabase
    .from('users')
    .update(patch)
    .eq('id', id)
    .select(userSelection)
    .maybeSingle()

  throwDatabaseError(error)
  return data ? toUser(data) : null
}

export async function markEmailVerified(id) {
  requireDatabase()
  const { data, error } = await supabase
    .from('users')
    .update({ email_verified: true })
    .eq('id', id)
    .select(userSelection)
    .maybeSingle()

  throwDatabaseError(error)
  return data ? toUser(data) : null
}

export async function updateUserPassword(id, passwordHash) {
  requireDatabase()
  const { data, error } = await supabase
    .from('users')
    .update({ password_hash: passwordHash })
    .eq('id', id)
    .select(userSelection)
    .maybeSingle()

  throwDatabaseError(error)
  if (!data) return null

  await bumpTokenVersion(id)
  return toUser(data)
}

export async function getApprovedPostsCount(id) {
  requireDatabase()
  const { data, error } = await supabase
    .from('users')
    .select('approved_posts_count')
    .eq('id', id)
    .maybeSingle()

  throwDatabaseError(error)
  return data?.approved_posts_count || 0
}

// Monotonic — incremented once per post the first time it's approved, never
// decremented, so a member's own edit-reverts-to-pending action can never
// shrink their submission tier.
export async function incrementApprovedPostsCount(id) {
  requireDatabase()
  const { error } = await supabase.rpc('increment_approved_posts_count', { target_user_id: id })
  throwDatabaseError(error)
}

export async function bumpTokenVersion(id) {
  requireDatabase()
  const { error } = await supabase.rpc('increment_token_version', { target_user_id: id })
  throwDatabaseError(error)
}

export async function deactivateUser(id) {
  requireDatabase()
  const { data, error } = await supabase
    .from('users')
    .update({ is_active: false })
    .eq('id', id)
    .select('id')
    .maybeSingle()

  throwDatabaseError(error)
  return Boolean(data)
}

export async function findUserIdByGoogleId(googleId) {
  requireDatabase()
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('google_id', googleId)
    .maybeSingle()

  throwDatabaseError(error)
  return data?.id || null
}

// Same character set as usernameSchema's regex (letters, numbers, underscore)
// — a Google-derived username still has to satisfy the same rule everywhere
// else a username is validated.
function sanitizeUsernameBase(email) {
  const localPart = email.split('@')[0] || ''
  const cleaned = localPart.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 90)
  return cleaned || 'member'
}

// Best-effort uniqueness: checked up front rather than relying solely on the
// DB's unique constraint, so a Google sign-in gets a clean auto-picked
// username instead of a raw constraint-violation error. The insert this feeds
// into still has the last word if two signups race on the same candidate —
// the same accepted gap as signup's checkUniqueFields-then-insert.
export async function generateUniqueUsername(email) {
  requireDatabase()
  const base = sanitizeUsernameBase(email)

  for (let attempt = 0; attempt < 25; attempt++) {
    const candidate = attempt === 0 ? base : `${base}${Math.floor(1000 + Math.random() * 9000)}`
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('username', candidate)
      .maybeSingle()
    throwDatabaseError(error)
    if (!data) return candidate
  }

  throw new HttpError(500, 'USERNAME_GENERATION_FAILED', 'Unable to generate a unique username')
}

// role is always 'user' — same rule signup enforces, Google sign-in isn't a
// path to an admin account.
export async function createGoogleUser({ googleId, email, username, firstName, lastName, profilePic }) {
  requireDatabase()
  const { data, error } = await supabase
    .from('users')
    .insert({
      google_id: googleId,
      email,
      username,
      first_name: firstName,
      last_name: lastName || null,
      password_hash: null,
      role: 'user',
      profile_pic: profilePic || null,
      email_verified: true,
    })
    .select('id')
    .single()

  throwDatabaseError(error)
  return data
}

export async function countActiveAdmins() {
  requireDatabase()
  const { count, error } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'admin')
    .eq('is_active', true)

  throwDatabaseError(error)
  return count || 0
}
