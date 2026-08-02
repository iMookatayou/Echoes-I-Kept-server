import { z } from 'zod'

const optionalText = z.string().trim().min(1).nullable().optional()

export const createNotificationSchema = z.object({
  userId: z.string().uuid(),
  type: z.string().trim().min(1).max(50),
  actorName: optionalText,
  actorAvatar: optionalText,
  action: z.string().trim().min(1).max(240),
  message: z.string().trim().max(2000).nullable().optional(),
  articleId: z.coerce.number().int().positive().nullable().optional(),
  articleTitle: z.string().trim().max(240).nullable().optional(),
})

export const notificationIdParamsSchema = z.object({
  id: z.string().uuid(),
})
