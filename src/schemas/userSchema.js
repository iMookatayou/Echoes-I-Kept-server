import { z } from 'zod'
import { getPasswordStrengthError } from '../utils/passwordValidation.js'

const usernameSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9_]+$/, 'Use only letters, numbers, and underscores.')

const requiredPasswordSchema = z.string().refine((value) => !getPasswordStrengthError(value), {
  message: 'Use 8+ characters with a letter and a symbol.',
})

const optionalPasswordSchema = z
  .string()
  .optional()
  .refine((value) => !value || !getPasswordStrengthError(value), {
    message: 'Use 8+ characters with a letter and a symbol.',
  })

export const createUserSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100).nullable().optional(),
  username: usernameSchema,
  email: z.string().trim().email(),
  password: requiredPasswordSchema,
  role: z.enum(['user', 'admin']),
  profilePic: z.string().trim().min(1).nullable().optional(),
})

export const updateUserSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100).nullable().optional(),
  username: usernameSchema,
  email: z.string().trim().email(),
  password: optionalPasswordSchema,
  role: z.enum(['user', 'admin']),
  profilePic: z.string().trim().min(1).nullable().optional(),
})

export const userIdParamsSchema = z.object({
  id: z.string().uuid(),
})
