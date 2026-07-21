import 'dotenv/config'
import { supabase } from '../src/supabaseClient.js'
import { hashPassword } from '../src/utils/passwordHash.js'

const email = process.env.SEED_ADMIN_EMAIL || 'admin@example.com'
const password = process.env.SEED_ADMIN_PASSWORD || 'Password123!'

async function main() {
  if (!supabase) {
    throw new Error('Supabase is not configured (check SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)')
  }

  const passwordHash = await hashPassword(password)

  const { data, error } = await supabase
    .from('users')
    .upsert(
      {
        email,
        username: 'admin',
        password_hash: passwordHash,
        first_name: 'Techin',
        last_name: 'B.',
        role: 'admin',
      },
      { onConflict: 'email' },
    )
    .select('id, email, role')
    .single()

  if (error) throw error

  console.log('Seeded admin user:', data)
  console.log(`Login with email="${email}" password="${password}" (dev only — rotate in production)`)
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
