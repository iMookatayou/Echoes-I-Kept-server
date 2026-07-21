import { z } from 'zod'

export const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(80),
})

export const updateCategorySchema = createCategorySchema

export const categoryIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
})
