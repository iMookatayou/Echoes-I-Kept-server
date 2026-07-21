import { HttpError } from '../utils/httpError.js'

export function requireAdmin(req, _res, next) {
  if (req.user?.role !== 'admin') {
    return next(new HttpError(403, 'FORBIDDEN', 'Admin access required'))
  }
  return next()
}
