import { rateLimit } from 'express-rate-limit'

// express-rate-limit's own default handler sends a plain-text body, not this
// app's { error: { code, message } } JSON convention — normalizeApiError on
// the client can't read a code or message out of that, so a rate-limited
// request showed a generic, unhelpful toast with no indication of what
// actually happened or that it's temporary. This restores the app's shape
// and tells the caller roughly how long to wait.
function jsonRateLimitHandler(req, res, _next, options) {
  const retryAfterSeconds = Number(res.getHeader('Retry-After')) || Math.ceil(options.windowMs / 1000)
  const retryAfterMinutes = Math.max(1, Math.ceil(retryAfterSeconds / 60))
  res.status(options.statusCode).json({
    error: {
      code: 'RATE_LIMITED',
      message: `Too many attempts. Please wait about ${retryAfterMinutes} minute${retryAfterMinutes === 1 ? '' : 's'} and try again.`,
    },
  })
}

// Coarse per-IP backstop only — on Vercel's serverless runtime this store
// isn't shared across function instances, so it can't be relied on for
// correctness. Its real value is bounding cross-account abuse (e.g.
// hammering forgot-password across many different addresses to burn Gmail's
// daily sending quota) that the per-user cooldown below can't see. The
// authoritative, IP-rotation-resistant defense is the 60s per-user+purpose
// cooldown and the 5-attempt lockout enforced in authController against the
// email_otps row
// itself.
export const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonRateLimitHandler,
})

export const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonRateLimitHandler,
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
  handler: jsonRateLimitHandler,
})
