import * as usersRepository from '../repositories/usersRepository.js'
import * as refreshTokensRepository from '../repositories/refreshTokensRepository.js'
import * as emailOtpsRepository from '../repositories/emailOtpsRepository.js'
import { hashPassword, comparePassword } from '../utils/passwordHash.js'
import { signAccessToken } from '../utils/jwt.js'
import { generateRefreshToken, hashToken } from '../utils/refreshToken.js'
import { generateOtpCode, hashOtpCode, otpExpiresAt, verifyOtpCode } from '../utils/otp.js'
import { sendOtpEmail } from '../utils/email.js'
import { defaultAvatarUrl } from '../utils/defaultAvatar.js'
import { HttpError } from '../utils/httpError.js'

const MAX_OTP_ATTEMPTS = 5
const OTP_RESEND_COOLDOWN_MS = 60 * 1000

async function issueSession({ id, role, tokenVersion }) {
  const accessToken = signAccessToken({ sub: id, role, tokenVersion })
  const { token: refreshToken, hash, expiresAt } = generateRefreshToken()
  await refreshTokensRepository.create({ userId: id, tokenHash: hash, expiresAt })
  return { accessToken, refreshToken }
}

function invalidCredentials() {
  return new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid email or password')
}

function invalidOrExpiredCode() {
  return new HttpError(400, 'INVALID_OR_EXPIRED_CODE', 'Invalid or expired code')
}

// Shared by signup/resend/forgot-password: enforces the per-user+purpose
// cooldown, invalidates any still-active previous code, and issues a fresh
// one. `throttled: true` means the caller should skip sending an email this
// time — callers that must stay enumeration-safe (resend/forgot-password)
// treat this identically to "sent", never surfacing it to the client.
async function issueOtpCode({ userId, purpose }) {
  const existing = await emailOtpsRepository.findActiveByUserAndPurpose(userId, purpose)
  if (existing && Date.now() - new Date(existing.created_at).getTime() < OTP_RESEND_COOLDOWN_MS) {
    return { throttled: true }
  }

  await emailOtpsRepository.invalidateActiveForUserAndPurpose(userId, purpose)
  const code = generateOtpCode()
  await emailOtpsRepository.create({
    userId,
    purpose,
    codeHash: hashOtpCode(code),
    expiresAt: otpExpiresAt(),
  })
  return { code, throttled: false }
}

// Verifies a submitted code against the latest active OTP for a user+purpose,
// bumping the attempt counter on a wrong guess and consuming it on success.
// Shared by verifyEmail/resetPasswordWithCode so both apply the exact same
// lockout/expiry/one-time-use rules.
async function consumeOtpCode({ userId, purpose, code }) {
  const otpRow = await emailOtpsRepository.findActiveByUserAndPurpose(userId, purpose)
  if (!otpRow || otpRow.attempt_count >= MAX_OTP_ATTEMPTS) throw invalidOrExpiredCode()

  if (!verifyOtpCode(code, otpRow.code_hash)) {
    await emailOtpsRepository.incrementAttempts(otpRow.id)
    throw invalidOrExpiredCode()
  }

  await emailOtpsRepository.consume(otpRow.id)
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
      profilePic: defaultAvatarUrl(firstName, lastName),
      emailVerified: false,
    })

    // Best-effort: the account is already created at this point, so a
    // Resend outage must not 502 the request and strand it (can't sign up
    // again — the email is now taken). The user can always recover via
    // resend-verification-code once email delivery is working again.
    try {
      const { code } = await issueOtpCode({ userId: user.id, purpose: 'signup_verify' })
      await sendOtpEmail({ to: email, code, purpose: 'signup_verify' })
    } catch {
      // swallow — see comment above
    }

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
    if (!row.email_verified) {
      throw new HttpError(403, 'EMAIL_NOT_VERIFIED', 'Please verify your email before logging in')
    }

    const { accessToken, refreshToken } = await issueSession({
      id: row.id,
      role: row.role,
      tokenVersion: row.token_version,
    })
    const user = await usersRepository.getUserById(row.id)

    return res.json({ data: user, accessToken, refreshToken })
  } catch (error) {
    return next(error)
  }
}

export async function refresh(req, res, next) {
  try {
    const { refreshToken: token } = req.validated.body

    const record = await refreshTokensRepository.findActiveByHash(hashToken(token))
    if (!record) {
      throw new HttpError(401, 'UNAUTHORIZED', 'Invalid or expired refresh token')
    }

    await refreshTokensRepository.revoke(record.id)

    const authState = await usersRepository.getAuthState(record.user_id)
    if (!authState || !authState.isActive) {
      throw new HttpError(401, 'UNAUTHORIZED', 'Invalid or expired refresh token')
    }

    const { accessToken, refreshToken } = await issueSession(authState)

    return res.json({ accessToken, refreshToken })
  } catch (error) {
    return next(error)
  }
}

export async function logout(req, res, next) {
  try {
    const { refreshToken: token } = req.validated.body
    const tokenRevoked = await refreshTokensRepository.revokeByHash(hashToken(token))

    return res.json({
      data: {
        loggedOut: true,
        tokenRevoked,
      },
    })
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
    const { firstName, lastName, username, email, profilePic, bio } = req.validated.body

    await usersRepository.checkUniqueFields({ email, username, excludeId: req.user.id })
    const user = await usersRepository.updateUser(req.user.id, {
      firstName,
      lastName,
      username,
      email,
      profilePic: profilePic || defaultAvatarUrl(firstName, lastName),
      bio,
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
    const { accessToken, refreshToken } = await issueSession(authState)

    return res.json({ data: user, accessToken, refreshToken })
  } catch (error) {
    return next(error)
  }
}

export async function verifyEmail(req, res, next) {
  try {
    const { email, code } = req.validated.body
    const row = await usersRepository.findUserForLogin(email)
    if (!row || !row.is_active) throw invalidOrExpiredCode()
    if (row.email_verified) {
      throw new HttpError(409, 'ALREADY_VERIFIED', 'This account is already verified')
    }

    await consumeOtpCode({ userId: row.id, purpose: 'signup_verify', code })
    await usersRepository.markEmailVerified(row.id)

    const authState = await usersRepository.getAuthState(row.id)
    const { accessToken, refreshToken } = await issueSession(authState)
    const user = await usersRepository.getUserById(row.id)

    return res.json({ data: user, accessToken, refreshToken })
  } catch (error) {
    return next(error)
  }
}

// Enumeration-safe: always 200, identical body, regardless of whether the
// account exists, is already verified, is inactive, or is inside the resend
// cooldown — a differing response would itself confirm the address is a
// real, unverified account.
export async function resendVerificationCode(req, res, next) {
  try {
    const { email } = req.validated.body
    const row = await usersRepository.findUserForLogin(email)

    if (row && row.is_active && !row.email_verified) {
      try {
        const { code, throttled } = await issueOtpCode({ userId: row.id, purpose: 'signup_verify' })
        if (!throttled) await sendOtpEmail({ to: email, code, purpose: 'signup_verify' })
      } catch {
        // swallow — response must stay identical either way
      }
    }

    return res.json({ data: { sent: true } })
  } catch (error) {
    return next(error)
  }
}

// Enumeration-safe: same reasoning as resendVerificationCode above.
export async function forgotPassword(req, res, next) {
  try {
    const { email } = req.validated.body
    const row = await usersRepository.findUserForLogin(email)

    if (row && row.is_active) {
      try {
        const { code, throttled } = await issueOtpCode({ userId: row.id, purpose: 'password_reset' })
        if (!throttled) await sendOtpEmail({ to: email, code, purpose: 'password_reset' })
      } catch {
        // swallow — response must stay identical either way
      }
    }

    return res.json({ data: { requested: true } })
  } catch (error) {
    return next(error)
  }
}

export async function resetPasswordWithCode(req, res, next) {
  try {
    const { email, code, newPassword } = req.validated.body
    const row = await usersRepository.findUserForLogin(email)
    if (!row || !row.is_active) throw invalidOrExpiredCode()

    await consumeOtpCode({ userId: row.id, purpose: 'password_reset', code })

    const passwordHash = await hashPassword(newPassword)
    const user = await usersRepository.updateUserPassword(row.id, passwordHash)
    await refreshTokensRepository.revokeAllForUser(row.id)
    // Proving mailbox control via a reset code is equally valid proof of
    // ownership as the signup code — mark verified too, so an unverified
    // account someone else typo'd into existence can be reclaimed and
    // logged into in one step instead of dead-ending at EMAIL_NOT_VERIFIED.
    if (!row.email_verified) await usersRepository.markEmailVerified(row.id)

    const authState = await usersRepository.getAuthState(row.id)
    const { accessToken, refreshToken } = await issueSession(authState)

    return res.json({ data: user, accessToken, refreshToken })
  } catch (error) {
    return next(error)
  }
}
