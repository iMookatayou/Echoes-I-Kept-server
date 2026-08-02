import { Router } from 'express'
import {
  createPost,
  deletePost,
  getPost,
  listPosts,
  updatePost,
} from '../controllers/postsController.js'
import { requireAdmin } from '../middleware/requireAdmin.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { validateRequest } from '../middleware/validateRequest.js'
import {
  createPostSchema,
  listPostsQuerySchema,
  postIdParamsSchema,
  updatePostSchema,
} from '../schemas/postSchema.js'

const postsRouter = Router()

postsRouter.get(
  '/',
  validateRequest({ query: listPostsQuerySchema }),
  listPosts,
)

postsRouter.get(
  '/:id',
  validateRequest({ params: postIdParamsSchema }),
  getPost,
)

postsRouter.post(
  '/',
  requireAuth,
  requireAdmin,
  validateRequest({ body: createPostSchema }),
  createPost,
)

postsRouter.put(
  '/:id',
  requireAuth,
  requireAdmin,
  validateRequest({ params: postIdParamsSchema, body: updatePostSchema }),
  updatePost,
)

postsRouter.delete(
  '/:id',
  requireAuth,
  requireAdmin,
  validateRequest({ params: postIdParamsSchema }),
  deletePost,
)

export default postsRouter
