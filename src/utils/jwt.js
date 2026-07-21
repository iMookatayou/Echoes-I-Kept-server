import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET
const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || '15m'

export function signAccessToken(payload) {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured')
  }
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN })
}

export function verifyAccessToken(token) {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured')
  }
  return jwt.verify(token, JWT_SECRET)
}
