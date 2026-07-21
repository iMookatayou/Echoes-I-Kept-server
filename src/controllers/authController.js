import * as usersRepository from '../repositories/usersRepository.js'
import * as refreshTokensRepository from '../repositories/refreshTokensRepository.js'
import { hashPassword, comparePassword } from '../utils/passwordHash.js'
import { signAccessToken } from '../utils/jwt.js'
import { generateRefreshToken, hashToken } from '../utils/refreshToken.js'
import { HttpError } from '../utils/httpError.js'

const COOKIE_SECURE = process.env.NODE_ENV === 'production'

function setAuthCookies(res, { accessToken, refreshToken, refreshTokenExpiresAt }) {
  res.cookie('access_token', accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: COOKIE_SECURE,
    path: '/',
  })
  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: COOKIE_SECURE,
    path: '/api/auth/refresh',
    expires: refreshTokenExpiresAt,
  })
}

function clearAuthCookies(res) {
  res.clearCookie('access_token', { path: '/' })
  res.clearCookie('refresh_token', { path: '/api/auth/refresh' })
}

async function issueSession(res, { id, role, tokenVersion }) {
  const accessToken = signAccessToken({ sub: id, role, tokenVersion })
  const { token: refreshToken, hash, expiresAt } = generateRefreshToken()
  await refreshTokensRepository.create({ userId: id, tokenHash: hash, expiresAt })
  setAuthCookies(res, { accessToken, refreshToken, refreshTokenExpiresAt: expiresAt })
}

function invalidCredentials() {
  return new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid email or password')
}

export async function signup(req, res, next) {
  try {
    const { firstName, lastName, username, email, password } = req.validated.body

    await usersRepository.checkUniqueFields({ email, username, excludeId: null })
    const passwordHash = await hashPassword(password)
    const user = await usersRepository.createUser({
      firstName,
      lastName,
      username,
      email,
      passwordHash,
      role: 'user',
      profilePic: null,
    })

    const authState = await usersRepository.getAuthState(user.id)
    await issueSession(res, authState)

    return res.status(201).json({ data: user })
  } catch (error) {
    return next(error)
  }
}

export async function login(req, res, next) {
  try {
    const { email, password, role } = req.validated.body
    const row = await usersRepository.findUserForLogin(email)

    if (!row || !row.is_active) throw invalidCredentials()
    if (role && row.role !== role) throw invalidCredentials()

    const passwordMatches = await comparePassword(password, row.password_hash)
    if (!passwordMatches) throw invalidCredentials()

    await issueSession(res, { id: row.id, role: row.role, tokenVersion: row.token_version })
    const user = await usersRepository.getUserById(row.id)

    return res.json({ data: user })
  } catch (error) {
    return next(error)
  }
}

export async function refresh(req, res, next) {
  try {
    const token = req.cookies?.refresh_token
    if (!token) {
      throw new HttpError(401, 'UNAUTHORIZED', 'No refresh token')
    }

    const record = await refreshTokensRepository.findActiveByHash(hashToken(token))
    if (!record) {
      throw new HttpError(401, 'UNAUTHORIZED', 'Invalid or expired refresh token')
    }

    await refreshTokensRepository.revoke(record.id)

    const authState = await usersRepository.getAuthState(record.user_id)
    if (!authState || !authState.isActive) {
      throw new HttpError(401, 'UNAUTHORIZED', 'Invalid or expired refresh token')
    }

    await issueSession(res, authState)

    return res.json({ ok: true })
  } catch (error) {
    return next(error)
  }
}

export async function logout(req, res, next) {
  try {
    const token = req.cookies?.refresh_token
    if (token) {
      await refreshTokensRepository.revokeByHash(hashToken(token))
    }

    clearAuthCookies(res)
    return res.json({ ok: true })
  } catch (error) {
    return next(error)
  }
}

export async function me(req, res, next) {
  try {
    const user = await usersRepository.getUserById(req.user.id)
    if (!user) {
      throw new HttpError(401, 'UNAUTHORIZED', 'Invalid or expired session')
    }

    return res.json({ data: user })
  } catch (error) {
    return next(error)
  }
}

export async function updateProfile(req, res, next) {
  try {
    const { firstName, lastName, username, email, profilePic } = req.validated.body

    await usersRepository.checkUniqueFields({ email, username, excludeId: req.user.id })
    const user = await usersRepository.updateUser(req.user.id, {
      firstName,
      lastName,
      username,
      email,
      profilePic,
    })
    if (!user) {
      throw new HttpError(404, 'USER_NOT_FOUND', 'User was not found')
    }

    return res.json({ data: user })
  } catch (error) {
    return next(error)
  }
}

export async function resetPassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.validated.body
    const row = await usersRepository.getUserRowById(req.user.id)
    if (!row) {
      throw new HttpError(401, 'UNAUTHORIZED', 'Invalid or expired session')
    }

    const matches = await comparePassword(currentPassword, row.password_hash)
    if (!matches) {
      throw new HttpError(400, 'INVALID_PASSWORD', 'Current password is incorrect')
    }

    const passwordHash = await hashPassword(newPassword)
    const user = await usersRepository.updateUserPassword(req.user.id, passwordHash)
    await refreshTokensRepository.revokeAllForUser(req.user.id)

    const authState = await usersRepository.getAuthState(req.user.id)
    await issueSession(res, authState)

    return res.json({ data: user })
  } catch (error) {
    return next(error)
  }
}
