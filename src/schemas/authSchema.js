import { z } from 'zod'
import { getPasswordStrengthError } from '../utils/passwordValidation.js'

const passwordSchema = z.string().refine((value) => !getPasswordStrengthError(value), {
  message: 'Use 8+ characters with a letter and a symbol.',
})

const usernameSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9_]+$/, 'Use only letters, numbers, and underscores.')

export const signupSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100).nullable().optional(),
  username: usernameSchema,
  email: z.string().trim().email(),
  password: passwordSchema,
})

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
  role: z.enum(['user', 'admin']).optional(),
})

export const updateProfileSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100).nullable().optional(),
  username: usernameSchema,
  email: z.string().trim().email(),
  profilePic: z.string().trim().min(1).nullable().optional(),
  bio: z.array(z.string().trim().min(1)).max(10).optional(),
})

export const resetPasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
})

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
})

const otpCodeSchema = z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code.')

export const verifyEmailSchema = z.object({
  email: z.string().trim().email(),
  code: otpCodeSchema,
})

export const resendVerificationSchema = z.object({
  email: z.string().trim().email(),
})

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email(),
})

// The token itself is the credential (a random 32-byte value, hex-encoded —
// see passwordResetToken.js) — no email needed alongside it, unlike the old
// code-based flow where the code alone was too short to trust on its own.
export const resetPasswordWithTokenSchema = z.object({
  token: z.string().trim().min(32),
  newPassword: passwordSchema,
})

// The ID token itself carries everything about the user — Google already
// verified the signature client-side; the server re-verifies signature,
// audience, issuer and expiry before trusting any of it. Nothing else in the
// body is needed or accepted.
export const googleAuthSchema = z.object({
  credential: z.string().min(1),
})
