import { Router } from 'express'
import {
  createUser,
  deleteUser,
  listUsers,
  updateUser,
} from '../controllers/usersController.js'
import { requireAdmin } from '../middleware/requireAdmin.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { validateRequest } from '../middleware/validateRequest.js'
import {
  createUserSchema,
  updateUserSchema,
  userIdParamsSchema,
} from '../schemas/userSchema.js'

const usersRouter = Router()

usersRouter.use(requireAuth, requireAdmin)

usersRouter.get('/', listUsers)

usersRouter.post('/', validateRequest({ body: createUserSchema }), createUser)

usersRouter.put(
  '/:id',
  validateRequest({ params: userIdParamsSchema, body: updateUserSchema }),
  updateUser,
)

usersRouter.delete(
  '/:id',
  validateRequest({ params: userIdParamsSchema }),
  deleteUser,
)

export default usersRouter
