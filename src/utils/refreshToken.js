import { randomBytes, createHash } from 'node:crypto'

const REFRESH_TOKEN_EXPIRES_IN_DAYS = Number(process.env.REFRESH_TOKEN_EXPIRES_IN_DAYS || 30)

export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

export function generateRefreshToken() {
  const token = randomBytes(40).toString('hex')
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000)

  return { token, hash: hashToken(token), expiresAt }
}
