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
})

export const resetPasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
})
