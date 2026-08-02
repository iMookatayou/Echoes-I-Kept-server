import * as commentsRepository from '../repositories/commentsRepository.js'
import * as postsRepository from '../repositories/postsRepository.js'
import * as notificationsRepository from '../repositories/notificationsRepository.js'
import { HttpError } from '../utils/httpError.js'

export async function listComments(req, res, next) {
  try {
    const comments = await commentsRepository.listByPostId(req.validated.params.postId)
    return res.json({ data: comments })
  } catch (error) {
    return next(error)
  }
}

export async function createComment(req, res, next) {
  try {
    const { postId } = req.validated.params
    const { commentText } = req.validated.body

    const post = await postsRepository.getPostById(postId)
    if (!post) {
      throw new HttpError(404, 'POST_NOT_FOUND', 'Post was not found')
    }

    const comment = await commentsRepository.create({
      postId,
      userId: req.user.id,
      commentText,
    })

    if (post.authorId && post.authorId !== req.user.id) {
      notificationsRepository
        .create({
          userId: post.authorId,
          type: 'comment',
          actorName: comment.authorName,
          actorAvatar: comment.authorAvatar,
          action: 'Commented on your article:',
          message: commentText,
          articleId: post.id,
          articleTitle: post.title,
        })
        .catch(() => {})
    }

    return res.status(201).json({ data: comment })
  } catch (error) {
    return next(error)
  }
}

export async function deleteComment(req, res, next) {
  try {
    const { id } = req.validated.params
    const comment = await commentsRepository.getById(id)
    if (!comment) {
      throw new HttpError(404, 'COMMENT_NOT_FOUND', 'Comment was not found')
    }

    if (comment.userId !== req.user.id && req.user.role !== 'admin') {
      throw new HttpError(403, 'FORBIDDEN', 'You can only delete your own comments')
    }

    await commentsRepository.remove(id)
    return res.status(204).send()
  } catch (error) {
    return next(error)
  }
}
