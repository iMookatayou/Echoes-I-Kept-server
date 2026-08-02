import { Router } from 'express'
import {
  createComment,
  deleteComment,
  listComments,
} from '../controllers/commentsController.js'
import { likePost, unlikePost } from '../controllers/likesController.js'
import {
  createPost,
  deletePost,
  getPost,
  listPosts,
  updatePost,
} from '../controllers/postsController.js'
import { optionalAuth } from '../middleware/optionalAuth.js'
import { requireAdmin } from '../middleware/requireAdmin.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { validateRequest } from '../middleware/validateRequest.js'
import {
  commentParamsSchema,
  createCommentSchema,
  postIdParamsSchema as commentsPostIdParamsSchema,
} from '../schemas/commentSchema.js'
import {
  createPostSchema,
  listPostsQuerySchema,
  postIdParamsSchema,
  updatePostSchema,
} from '../schemas/postSchema.js'

const postsRouter = Router()

postsRouter.get(
  '/',
  optionalAuth,
  validateRequest({ query: listPostsQuerySchema }),
  listPosts,
)

postsRouter.get(
  '/:id',
  optionalAuth,
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

postsRouter.get(
  '/:postId/comments',
  validateRequest({ params: commentsPostIdParamsSchema }),
  listComments,
)

postsRouter.post(
  '/:postId/comments',
  requireAuth,
  validateRequest({ params: commentsPostIdParamsSchema, body: createCommentSchema }),
  createComment,
)

postsRouter.delete(
  '/:postId/comments/:id',
  requireAuth,
  validateRequest({ params: commentParamsSchema }),
  deleteComment,
)

postsRouter.post(
  '/:postId/likes',
  requireAuth,
  validateRequest({ params: commentsPostIdParamsSchema }),
  likePost,
)

postsRouter.delete(
  '/:postId/likes',
  requireAuth,
  validateRequest({ params: commentsPostIdParamsSchema }),
  unlikePost,
)

export default postsRouter
