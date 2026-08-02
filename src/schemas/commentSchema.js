import { z } from 'zod'

export const createCommentSchema = z.object({
  commentText: z.string().trim().min(1).max(2000),
})

export const postIdParamsSchema = z.object({
  postId: z.coerce.number().int().positive(),
})

export const commentParamsSchema = z.object({
  postId: z.coerce.number().int().positive(),
  id: z.coerce.number().int().positive(),
})
