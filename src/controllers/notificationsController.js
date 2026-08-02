import * as notificationsRepository from '../repositories/notificationsRepository.js'
import { HttpError } from '../utils/httpError.js'

export async function listNotifications(req, res, next) {
  try {
    const notifications = await notificationsRepository.listByUserId(req.user.id)
    return res.json({ data: notifications })
  } catch (error) {
    return next(error)
  }
}

export async function createNotification(req, res, next) {
  try {
    const notification = await notificationsRepository.create(req.validated.body)
    return res.status(201).json({ data: notification })
  } catch (error) {
    return next(error)
  }
}

export async function markNotificationRead(req, res, next) {
  try {
    const notification = await notificationsRepository.markAsRead(
      req.validated.params.id,
      req.user.id,
    )
    if (!notification) {
      throw new HttpError(404, 'NOTIFICATION_NOT_FOUND', 'Notification was not found')
    }

    return res.json({ data: notification })
  } catch (error) {
    return next(error)
  }
}

export async function markAllNotificationsRead(req, res, next) {
  try {
    await notificationsRepository.markAllAsRead(req.user.id)
    return res.json({ data: { markedAllRead: true } })
  } catch (error) {
    return next(error)
  }
}
