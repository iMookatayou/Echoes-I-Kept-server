import * as postsRepository from '../repositories/postsRepository.js'
import * as likesRepository from '../repositories/likesRepository.js'
import * as usersRepository from '../repositories/usersRepository.js'
import * as notificationsRepository from '../repositories/notificationsRepository.js'
import { HttpError } from '../utils/httpError.js'

// Cap scales with the member's track record of already-approved posts, so
// spam/new accounts are the most constrained and it eases up as trust builds.
function pendingCapFor(approvedPostsCount) {
  if (approvedPostsCount >= 5) return 7
  if (approvedPostsCount >= 1) return 3
  return 1
}

async function assertUnderSubmissionCap(userId) {
  const approvedPostsCount = await usersRepository.getApprovedPostsCount(userId)
  const cap = pendingCapFor(approvedPostsCount)
  const pendingCount = await postsRepository.countByAuthorAndStatus(userId, 'pending')

  if (pendingCount >= cap) {
    throw new HttpError(
      429,
      'SUBMISSION_LIMIT',
      `You can have at most ${cap} post${cap === 1 ? '' : 's'} awaiting review at a time`,
    )
  }
}

function canView(post, user) {
  if (post.status === 'published') return true
  if (user?.role === 'admin') return true
  return Boolean(user) && post.authorId !== null && post.authorId === user.id
}

function isOwner(post, user) {
  return Boolean(user) && post.authorId !== null && post.authorId === user.id
}

export async function listPosts(req, res, next) {
  try {
    const query = req.validated.query
    let effectiveQuery = query

    if (req.user?.role === 'admin') {
      // pass through unchanged — admins can query any status/author
    } else if (query.mine && req.user) {
      effectiveQuery = { ...query, authorId: req.user.id }
    } else if (query.status !== 'published') {
      throw new HttpError(
        403,
        'DRAFT_ACCESS_DISABLED',
        'Draft access requires an admin session',
      )
    }

    const { posts, total } = await postsRepository.listPosts(effectiveQuery)

    return res.json({
      data: posts,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    })
  } catch (error) {
    return next(error)
  }
}

export async function getPost(req, res, next) {
  try {
    const post = await postsRepository.getPostById(req.validated.params.id)
    if (!post || !canView(post, req.user)) {
      throw new HttpError(404, 'POST_NOT_FOUND', 'Post was not found')
    }

    const likedByMe = req.user
      ? await likesRepository.exists({ postId: post.id, userId: req.user.id })
      : false

    return res.json({ data: { ...post, likedByMe } })
  } catch (error) {
    return next(error)
  }
}

export async function createPost(req, res, next) {
  try {
    let payload = req.validated.body

    if (req.user.role !== 'admin') {
      await assertUnderSubmissionCap(req.user.id)

      const author = await usersRepository.getUserById(req.user.id)
      payload = {
        ...payload,
        status: 'pending',
        publishedAt: null,
        authorName: [author.firstName, author.lastName].filter(Boolean).join(' ') || author.username,
        authorAvatar: author.profilePic,
        authorBio: [],
      }
    }

    const post = await postsRepository.createPost(payload, req.user.id)
    return res.status(201).json({ data: post })
  } catch (error) {
    return next(error)
  }
}

export async function updatePost(req, res, next) {
  try {
    const existing = await postsRepository.getPostById(req.validated.params.id)
    if (!existing) {
      throw new HttpError(404, 'POST_NOT_FOUND', 'Post was not found')
    }

    if (req.user.role !== 'admin' && !isOwner(existing, req.user)) {
      throw new HttpError(403, 'FORBIDDEN', 'You can only edit your own posts')
    }

    let payload = req.validated.body

    if (req.user.role !== 'admin') {
      if (existing.status !== 'pending') {
        await assertUnderSubmissionCap(req.user.id)
      }
      payload = { ...payload, status: 'pending', publishedAt: null }
    }

    const post = await postsRepository.updatePost(req.validated.params.id, payload)
    if (!post) {
      throw new HttpError(404, 'POST_NOT_FOUND', 'Post was not found')
    }

    return res.json({ data: post })
  } catch (error) {
    return next(error)
  }
}

export async function deletePost(req, res, next) {
  try {
    const existing = await postsRepository.getPostById(req.validated.params.id)
    if (!existing) {
      throw new HttpError(404, 'POST_NOT_FOUND', 'Post was not found')
    }

    if (req.user.role !== 'admin') {
      if (!isOwner(existing, req.user)) {
        throw new HttpError(403, 'FORBIDDEN', 'You can only delete your own posts')
      }
      if (existing.status === 'published') {
        throw new HttpError(403, 'FORBIDDEN', 'Only an admin can delete a published post')
      }
    }

    const deleted = await postsRepository.deletePost(req.validated.params.id)
    if (!deleted) {
      throw new HttpError(404, 'POST_NOT_FOUND', 'Post was not found')
    }

    return res.status(204).send()
  } catch (error) {
    return next(error)
  }
}

export async function approvePost(req, res, next) {
  try {
    const existing = await postsRepository.getPostById(req.validated.params.id)
    if (!existing) {
      throw new HttpError(404, 'POST_NOT_FOUND', 'Post was not found')
    }
    if (existing.status !== 'pending') {
      throw new HttpError(409, 'NOT_PENDING', 'Only a pending post can be approved')
    }

    const now = new Date().toISOString()
    const post = await postsRepository.updatePostModeration(existing.id, {
      status: 'published',
      rejectionReason: null,
      moderatedBy: req.user.id,
      publishedAt: existing.publishedAt || now,
      firstPublishedAt: existing.firstPublishedAt || now,
    })

    if (existing.authorId) {
      usersRepository.incrementApprovedPostsCount(existing.authorId).catch(() => {})

      notificationsRepository
        .create({
          userId: existing.authorId,
          type: 'post_approved',
          actorName: 'Echoes I Kept',
          action: 'Your post was approved and is now live:',
          articleId: post.id,
          articleTitle: post.title,
        })
        .catch(() => {})
    }

    return res.json({ data: post })
  } catch (error) {
    return next(error)
  }
}

export async function rejectPost(req, res, next) {
  try {
    const existing = await postsRepository.getPostById(req.validated.params.id)
    if (!existing) {
      throw new HttpError(404, 'POST_NOT_FOUND', 'Post was not found')
    }
    if (existing.status !== 'pending') {
      throw new HttpError(409, 'NOT_PENDING', 'Only a pending post can be rejected')
    }

    const { reason } = req.validated.body

    const post = await postsRepository.updatePostModeration(existing.id, {
      status: 'rejected',
      rejectionReason: reason,
      moderatedBy: req.user.id,
      publishedAt: existing.publishedAt,
      firstPublishedAt: existing.firstPublishedAt,
    })

    if (existing.authorId) {
      notificationsRepository
        .create({
          userId: existing.authorId,
          type: 'post_rejected',
          actorName: 'Echoes I Kept',
          action: 'Your post was not approved:',
          message: reason,
          articleId: post.id,
          articleTitle: post.title,
        })
        .catch(() => {})
    }

    return res.json({ data: post })
  } catch (error) {
    return next(error)
  }
}
