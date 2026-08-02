import { Router } from 'express'
import {
  createComment,
  deleteComment,
  listComments,
} from '../controllers/commentsController.js'
import { likePost, unlikePost } from '../controllers/likesController.js'
import {
  approvePost,
  createPost,
  deletePost,
  getPost,
  listPosts,
  rejectPost,
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
  rejectPostSchema,
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
  validateRequest({ body: createPostSchema }),
  createPost,
)

postsRouter.put(
  '/:id',
  requireAuth,
  validateRequest({ params: postIdParamsSchema, body: updatePostSchema }),
  updatePost,
)

postsRouter.delete(
  '/:id',
  requireAuth,
  validateRequest({ params: postIdParamsSchema }),
  deletePost,
)

postsRouter.put(
  '/:id/approve',
  requireAuth,
  requireAdmin,
  validateRequest({ params: postIdParamsSchema }),
  approvePost,
)

postsRouter.put(
  '/:id/reject',
  requireAuth,
  requireAdmin,
  validateRequest({ params: postIdParamsSchema, body: rejectPostSchema }),
  rejectPost,
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
