import 'dotenv/config'
import { OAuth2Client } from 'google-auth-library'
import { HttpError } from './utils/httpError.js'

const googleClientId = process.env.GOOGLE_CLIENT_ID

export function hasGoogleConfig() {
  return Boolean(googleClientId)
}

const client = hasGoogleConfig() ? new OAuth2Client(googleClientId) : null

// Verifies the ID token's signature, audience, issuer and expiry against
// Google's own public keys — this is what makes trusting `payload.email` safe
// without a redirect flow or a client secret. Anything that fails any of
// those checks throws here rather than returning a falsy payload, so a caller
// can't forget to check a boolean and fall through with garbage.
export async function verifyGoogleIdToken(idToken) {
  if (!client) {
    throw new HttpError(
      503,
      'GOOGLE_AUTH_NOT_CONFIGURED',
      'Set GOOGLE_CLIENT_ID in the server environment to enable Google sign-in',
    )
  }

  try {
    const ticket = await client.verifyIdToken({ idToken, audience: googleClientId })
    return ticket.getPayload()
  } catch {
    // Never surface the library's own error text — it can echo back the
    // token or audience details, which shouldn't leave the server.
    throw new HttpError(401, 'INVALID_GOOGLE_TOKEN', 'Unable to verify Google sign-in')
  }
}
