import { Router } from 'express'
import {
  createPost,
  deletePost,
  getPost,
  listPosts,
  updatePost,
} from '../controllers/postsController.js'
import { localMutationOnly } from '../middleware/localMutationOnly.js'
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
  localMutationOnly,
  validateRequest({ body: createPostSchema }),
  createPost,
)

postsRouter.put(
  '/:id',
  localMutationOnly,
  validateRequest({ params: postIdParamsSchema, body: updatePostSchema }),
  updatePost,
)

postsRouter.delete(
  '/:id',
  localMutationOnly,
  validateRequest({ params: postIdParamsSchema }),
  deletePost,
)

export default postsRouter
