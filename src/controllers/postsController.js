import * as postsRepository from '../repositories/postsRepository.js'
import { isLocalSupabaseConfig } from '../supabaseClient.js'
import { HttpError } from '../utils/httpError.js'

export async function listPosts(req, res, next) {
  try {
    const query = req.validated.query
    if (!isLocalSupabaseConfig() && query.status !== 'published') {
      throw new HttpError(
        403,
        'DRAFT_ACCESS_DISABLED',
        'Draft access requires local Supabase until backend authentication is available',
      )
    }

    const { posts, total } = await postsRepository.listPosts(query)

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
    if (!post || (!isLocalSupabaseConfig() && post.status !== 'published')) {
      throw new HttpError(404, 'POST_NOT_FOUND', 'Post was not found')
    }

    return res.json({ data: post })
  } catch (error) {
    return next(error)
  }
}

export async function createPost(req, res, next) {
  try {
    const post = await postsRepository.createPost(req.validated.body)
    return res.status(201).json({ data: post })
  } catch (error) {
    return next(error)
  }
}

export async function updatePost(req, res, next) {
  try {
    const post = await postsRepository.updatePost(
      req.validated.params.id,
      req.validated.body,
    )
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
    const deleted = await postsRepository.deletePost(req.validated.params.id)
    if (!deleted) {
      throw new HttpError(404, 'POST_NOT_FOUND', 'Post was not found')
    }

    return res.status(204).send()
  } catch (error) {
    return next(error)
  }
}
