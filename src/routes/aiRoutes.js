import { Router } from 'express'
import {
  checkBeforeSubmit,
  moderatePost,
  polishDraft,
  translatePost,
} from '../controllers/aiController.js'
import { aiLimiter } from '../middleware/rateLimit.js'
import { optionalAuth } from '../middleware/optionalAuth.js'
import { requireAdmin } from '../middleware/requireAdmin.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { validateRequest } from '../middleware/validateRequest.js'
import {
  moderateSchema,
  polishSchema,
  presubmitCheckSchema,
  translateSchema,
} from '../schemas/aiSchema.js'

const aiRouter = Router()

// Rate-limited even for the anonymous-reachable route below — every AI call
// costs money, whether or not it ends up hitting the model (see /translate).
aiRouter.use(aiLimiter)

aiRouter.post('/polish', requireAuth, validateRequest({ body: polishSchema }), polishDraft)

// Combines a readiness self-check with first-reader feedback in one call.
aiRouter.post(
  '/presubmit-check',
  requireAuth,
  validateRequest({ body: presubmitCheckSchema }),
  checkBeforeSubmit,
)

// Advisory analysis for the moderation queue. Publishing still happens only
// through PUT /api/posts/:id/approve, which is unchanged.
aiRouter.post(
  '/moderate',
  requireAuth,
  requireAdmin,
  validateRequest({ body: moderateSchema }),
  moderatePost,
)

// Reader-facing and, unlike the three endpoints above, reachable while
// signed out — optionalAuth sets req.user when a valid token is present but
// never rejects. Anonymous readers can view an already-translated post for
// free; the controller only requires a login for the path that actually
// spends a quota slot (an uncached language generating a fresh translation).
aiRouter.post(
  '/translate',
  optionalAuth,
  validateRequest({ body: translateSchema }),
  translatePost,
)

export default aiRouter
