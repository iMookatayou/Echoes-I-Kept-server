import { randomBytes, createHash } from 'node:crypto'

// Short-lived by design (OWASP recommends minutes, not hours) — this token
// sits in a URL, which is a wider exposure surface than a form field
// (browser history, email client logs), so the window it's dangerous in
// should be as small as reasonably convenient for the user.
export const PASSWORD_RESET_TOKEN_EXPIRES_IN_MINUTES = Number(
  process.env.PASSWORD_RESET_TOKEN_EXPIRES_IN_MINUTES || 30,
)

export function hashResetToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

// Same shape as generateRefreshToken(): a random opaque value the caller
// gets once, only its hash is ever stored. 32 bytes (256 bits) is far beyond
// brute-forceable regardless of the 30-minute window.
export function generatePasswordResetToken() {
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_EXPIRES_IN_MINUTES * 60 * 1000)

  return { token, hash: hashResetToken(token), expiresAt }
}
