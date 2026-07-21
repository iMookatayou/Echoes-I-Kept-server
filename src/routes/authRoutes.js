import { Router } from 'express'
import {
  login,
  logout,
  me,
  refresh,
  resetPassword,
  signup,
  updateProfile,
} from '../controllers/authController.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { validateRequest } from '../middleware/validateRequest.js'
import {
  loginSchema,
  resetPasswordSchema,
  signupSchema,
  updateProfileSchema,
} from '../schemas/authSchema.js'

const authRouter = Router()

authRouter.post('/signup', validateRequest({ body: signupSchema }), signup)
authRouter.post('/login', validateRequest({ body: loginSchema }), login)
authRouter.post('/refresh', refresh)
authRouter.post('/logout', logout)

authRouter.get('/me', requireAuth, me)
authRouter.put(
  '/me',
  requireAuth,
  validateRequest({ body: updateProfileSchema }),
  updateProfile,
)
authRouter.put(
  '/me/password',
  requireAuth,
  validateRequest({ body: resetPasswordSchema }),
  resetPassword,
)

export default authRouter
