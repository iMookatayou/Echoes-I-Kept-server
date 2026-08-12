import { Router } from 'express'
import {
  forgotPassword,
  googleAuth,
  login,
  logout,
  me,
  refresh,
  resendVerificationCode,
  resetPassword,
  resetPasswordWithToken,
  signup,
  updateProfile,
  verifyEmail,
} from '../controllers/authController.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { validateRequest } from '../middleware/validateRequest.js'
import { otpRequestLimiter, otpVerifyLimiter } from '../middleware/rateLimit.js'
import {
  forgotPasswordSchema,
  googleAuthSchema,
  loginSchema,
  refreshTokenSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  resetPasswordWithTokenSchema,
  signupSchema,
  updateProfileSchema,
  verifyEmailSchema,
} from '../schemas/authSchema.js'

const authRouter = Router()

authRouter.post('/signup', otpRequestLimiter, validateRequest({ body: signupSchema }), signup)
authRouter.post('/login', validateRequest({ body: loginSchema }), login)
authRouter.post('/google', validateRequest({ body: googleAuthSchema }), googleAuth)
authRouter.post('/refresh', validateRequest({ body: refreshTokenSchema }), refresh)
authRouter.post('/logout', validateRequest({ body: refreshTokenSchema }), logout)

authRouter.post(
  '/verify-email',
  otpVerifyLimiter,
  validateRequest({ body: verifyEmailSchema }),
  verifyEmail,
)
authRouter.post(
  '/resend-verification-code',
  otpRequestLimiter,
  validateRequest({ body: resendVerificationSchema }),
  resendVerificationCode,
)
authRouter.post(
  '/forgot-password',
  otpRequestLimiter,
  validateRequest({ body: forgotPasswordSchema }),
  forgotPassword,
)
authRouter.post(
  '/reset-password',
  otpVerifyLimiter,
  validateRequest({ body: resetPasswordWithTokenSchema }),
  resetPasswordWithToken,
)

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
