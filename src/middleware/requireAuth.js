import { verifyAccessToken } from '../utils/jwt.js'
import * as usersRepository from '../repositories/usersRepository.js'
import { HttpError } from '../utils/httpError.js'

export async function requireAuth(req, _res, next) {
  try {
    const token = req.cookies?.access_token
    if (!token) {
      throw new HttpError(401, 'UNAUTHORIZED', 'Authentication required')
    }

    let payload
    try {
      payload = verifyAccessToken(token)
    } catch {
      throw new HttpError(401, 'UNAUTHORIZED', 'Invalid or expired session')
    }

    const authState = await usersRepository.getAuthState(payload.sub)
    if (
      !authState ||
      !authState.isActive ||
      authState.tokenVersion !== payload.tokenVersion
    ) {
      throw new HttpError(401, 'UNAUTHORIZED', 'Invalid or expired session')
    }

    req.user = { id: authState.id, role: authState.role }
    return next()
  } catch (error) {
    return next(error)
  }
}
