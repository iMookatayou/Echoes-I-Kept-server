import { rateLimit } from 'express-rate-limit'

// Coarse per-IP backstop only — on Vercel's serverless runtime this store
// isn't shared across function instances, so it can't be relied on for
// correctness. Its real value is bounding cross-account abuse (e.g.
// hammering forgot-password across many different addresses to burn Resend
// quota) that the per-user cooldown below can't see. The authoritative,
// IP-rotation-resistant defense is the 60s per-user+purpose cooldown and the
// 5-attempt lockout enforced in authController against the email_otps row
// itself.
export const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
})

export const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
})

// Same caveat as the OTP limiters — per-IP and not shared across serverless
// instances, so this is a burst backstop, not the quota. The authoritative
// limit for AI calls is the per-user daily allowance enforced in the database
// by consume_ai_quota, which an attacker can't sidestep by rotating IPs.
export const aiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
})
