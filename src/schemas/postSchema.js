import { z } from 'zod'

const optionalText = z.string().trim().min(1).nullable().optional()
const statusSchema = z.enum(['draft', 'pending', 'published', 'rejected'])

const contentFieldsSchema = z.object({
  category: z.string().trim().min(1).max(80),
  artist: optionalText,
  bestPick: optionalText,
  spotifyUrl: optionalText,
  image: z.string().trim().min(1).url(),
  detailImage: optionalText,
  detailImagePosition: z.string().trim().min(1).default('center'),
  title: z.string().trim().min(1).max(240),
  description: z.string().trim().min(1).max(2000),
  content: z.string().trim().min(1),
  publishedAt: z.string().datetime({ offset: true }).nullable().optional(),
})

const authorFieldsSchema = z.object({
  authorName: z.string().trim().min(1).max(120).default('Techin B.'),
  authorAvatar: optionalText,
  authorBio: z.array(z.string().trim().min(1)).max(10).default([]),
})

export const createPostSchema = contentFieldsSchema.merge(authorFieldsSchema).extend({
  status: statusSchema.default('draft'),
})

// Author identity is set at creation time and preserved by the repository on
// every update — it is never taken from the update payload (see
// postsRepository.updatePost), so these fields are intentionally absent here.
export const updatePostSchema = contentFieldsSchema.extend({
  status: statusSchema,
})

export const rejectPostSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
})

export const postIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const listPostsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(6),
  status: z.enum(['draft', 'pending', 'published', 'rejected', 'all']).default('published'),
  category: z.string().trim().min(1).max(80).optional(),
  search: z.string().trim().max(200).optional(),
  mine: z.coerce.boolean().optional(),
})
