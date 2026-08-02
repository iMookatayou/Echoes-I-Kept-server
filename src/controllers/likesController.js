import * as likesRepository from '../repositories/likesRepository.js'
import * as postsRepository from '../repositories/postsRepository.js'
import * as notificationsRepository from '../repositories/notificationsRepository.js'
import * as usersRepository from '../repositories/usersRepository.js'
import { HttpError } from '../utils/httpError.js'

function displayName(user) {
  if (!user) return 'Someone'
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username
}

export async function likePost(req, res, next) {
  try {
    const { postId } = req.validated.params
    const post = await postsRepository.getPostById(postId)
    if (!post) {
      throw new HttpError(404, 'POST_NOT_FOUND', 'Post was not found')
    }

    await likesRepository.create({ postId, userId: req.user.id })

    if (post.authorId && post.authorId !== req.user.id) {
      const liker = await usersRepository.getUserById(req.user.id)
      notificationsRepository
        .create({
          userId: post.authorId,
          type: 'like',
          actorName: displayName(liker),
          actorAvatar: liker?.profilePic || null,
          action: 'liked your article:',
          articleId: post.id,
          articleTitle: post.title,
        })
        .catch(() => {})
    }

    const updated = await postsRepository.getPostById(postId)
    return res.status(201).json({ data: { likesCount: updated.likesCount, liked: true } })
  } catch (error) {
    return next(error)
  }
}

export async function unlikePost(req, res, next) {
  try {
    const { postId } = req.validated.params
    const post = await postsRepository.getPostById(postId)
    if (!post) {
      throw new HttpError(404, 'POST_NOT_FOUND', 'Post was not found')
    }

    await likesRepository.remove({ postId, userId: req.user.id })

    const updated = await postsRepository.getPostById(postId)
    return res.json({ data: { likesCount: updated.likesCount, liked: false } })
  } catch (error) {
    return next(error)
  }
}
