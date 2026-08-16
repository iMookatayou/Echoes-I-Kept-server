import { verifyAccessToken } from '../utils/jwt.js'
import * as usersRepository from '../repositories/usersRepository.js'

export async function optionalAuth(req, _res, next) {
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) {
    return next()
  }

  try {
    const payload = verifyAccessToken(token)
    const authState = await usersRepository.getAuthState(payload.sub)

    if (
      authState &&
      authState.isActive &&
      authState.tokenVersion === payload.tokenVersion
    ) {
      req.user = { id: authState.id, role: authState.role }
    }
  } catch {
    // invalid/expired token — proceed unauthenticated rather than rejecting
  }

  return next()
}
