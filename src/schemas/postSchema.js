import { z } from 'zod'

const optionalText = z.string().trim().min(1).nullable().optional()
const statusSchema = z.enum(['draft', 'published'])

const basePostSchema = z.object({
  category: z.string().trim().min(1).max(80),
  artist: optionalText,
  bestPick: optionalText,
  spotifyUrl: optionalText,
  image: z.string().trim().min(1),
  detailImage: optionalText,
  detailImagePosition: z.string().trim().min(1).default('center'),
  title: z.string().trim().min(1).max(240),
  description: z.string().trim().min(1).max(2000),
  content: z.string().trim().min(1),
  authorName: z.string().trim().min(1).max(120).default('Techin B.'),
  authorAvatar: optionalText,
  authorBio: z.array(z.string().trim().min(1)).max(10).default([]),
  publishedAt: z.string().datetime({ offset: true }).nullable().optional(),
})

export const createPostSchema = basePostSchema.extend({
  status: statusSchema.default('draft'),
})

export const updatePostSchema = basePostSchema.extend({
  status: statusSchema,
})

export const postIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const listPostsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(6),
  status: z.enum(['draft', 'published', 'all']).default('published'),
  category: z.string().trim().min(1).max(80).optional(),
  search: z.string().trim().max(200).optional(),
})
