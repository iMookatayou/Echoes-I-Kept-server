import { Router } from 'express'
import {
  checkBeforeSubmit,
  moderatePost,
  polishDraft,
} from '../controllers/aiController.js'
import { aiLimiter } from '../middleware/rateLimit.js'
import { requireAdmin } from '../middleware/requireAdmin.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { validateRequest } from '../middleware/validateRequest.js'
import {
  moderateSchema,
  polishSchema,
  presubmitCheckSchema,
} from '../schemas/aiSchema.js'

const aiRouter = Router()

// Every AI call costs money, so none of this is reachable anonymously.
aiRouter.use(requireAuth, aiLimiter)

aiRouter.post('/polish', validateRequest({ body: polishSchema }), polishDraft)

// Combines a readiness self-check with first-reader feedback in one call.
aiRouter.post(
  '/presubmit-check',
  validateRequest({ body: presubmitCheckSchema }),
  checkBeforeSubmit,
)

// Advisory analysis for the moderation queue. Publishing still happens only
// through PUT /api/posts/:id/approve, which is unchanged.
aiRouter.post(
  '/moderate',
  requireAdmin,
  validateRequest({ body: moderateSchema }),
  moderatePost,
)

export default aiRouter
