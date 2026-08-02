import { Router } from 'express'
import {
  createCategory,
  deleteCategory,
  getCategory,
  listCategories,
  updateCategory,
} from '../controllers/categoriesController.js'
import { requireAdmin } from '../middleware/requireAdmin.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { validateRequest } from '../middleware/validateRequest.js'
import {
  categoryIdParamsSchema,
  createCategorySchema,
  updateCategorySchema,
} from '../schemas/categorySchema.js'

const categoriesRouter = Router()

categoriesRouter.get('/', listCategories)

categoriesRouter.get(
  '/:id',
  validateRequest({ params: categoryIdParamsSchema }),
  getCategory,
)

categoriesRouter.post(
  '/',
  requireAuth,
  requireAdmin,
  validateRequest({ body: createCategorySchema }),
  createCategory,
)

categoriesRouter.put(
  '/:id',
  requireAuth,
  requireAdmin,
  validateRequest({ params: categoryIdParamsSchema, body: updateCategorySchema }),
  updateCategory,
)

categoriesRouter.delete(
  '/:id',
  requireAuth,
  requireAdmin,
  validateRequest({ params: categoryIdParamsSchema }),
  deleteCategory,
)

export default categoriesRouter
