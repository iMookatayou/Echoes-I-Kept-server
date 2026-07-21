import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 10

export async function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS)
}

export async function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash)
}
