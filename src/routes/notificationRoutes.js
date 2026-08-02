import { Router } from 'express'
import {
  createNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../controllers/notificationsController.js'
import { requireAdmin } from '../middleware/requireAdmin.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { validateRequest } from '../middleware/validateRequest.js'
import {
  createNotificationSchema,
  notificationIdParamsSchema,
} from '../schemas/notificationSchema.js'

const notificationRouter = Router()

notificationRouter.use(requireAuth)

notificationRouter.get('/', listNotifications)

notificationRouter.put('/read-all', markAllNotificationsRead)

notificationRouter.put(
  '/:id/read',
  validateRequest({ params: notificationIdParamsSchema }),
  markNotificationRead,
)

notificationRouter.post(
  '/',
  requireAdmin,
  validateRequest({ body: createNotificationSchema }),
  createNotification,
)

export default notificationRouter
