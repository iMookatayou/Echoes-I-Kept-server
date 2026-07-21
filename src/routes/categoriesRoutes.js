import { Router } from 'express'
import {
  createCategory,
  deleteCategory,
  getCategory,
  listCategories,
  updateCategory,
} from '../controllers/categoriesController.js'
import { localMutationOnly } from '../middleware/localMutationOnly.js'
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
  localMutationOnly,
  validateRequest({ body: createCategorySchema }),
  createCategory,
)

categoriesRouter.put(
  '/:id',
  localMutationOnly,
  validateRequest({ params: categoryIdParamsSchema, body: updateCategorySchema }),
  updateCategory,
)

categoriesRouter.delete(
  '/:id',
  localMutationOnly,
  validateRequest({ params: categoryIdParamsSchema }),
  deleteCategory,
)

export default categoriesRouter
