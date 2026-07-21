import * as categoriesRepository from '../repositories/categoriesRepository.js'
import { HttpError } from '../utils/httpError.js'

export async function listCategories(req, res, next) {
  try {
    const categories = await categoriesRepository.listCategories()
    return res.json({ data: categories })
  } catch (error) {
    return next(error)
  }
}

export async function getCategory(req, res, next) {
  try {
    const category = await categoriesRepository.getCategoryById(req.validated.params.id)
    if (!category) {
      throw new HttpError(404, 'CATEGORY_NOT_FOUND', 'Category was not found')
    }

    return res.json({ data: category })
  } catch (error) {
    return next(error)
  }
}

export async function createCategory(req, res, next) {
  try {
    const category = await categoriesRepository.createCategory(req.validated.body)
    return res.status(201).json({ data: category })
  } catch (error) {
    return next(error)
  }
}

export async function updateCategory(req, res, next) {
  try {
    const category = await categoriesRepository.updateCategory(
      req.validated.params.id,
      req.validated.body,
    )
    if (!category) {
      throw new HttpError(404, 'CATEGORY_NOT_FOUND', 'Category was not found')
    }

    return res.json({ data: category })
  } catch (error) {
    return next(error)
  }
}

export async function deleteCategory(req, res, next) {
  try {
    const deleted = await categoriesRepository.deleteCategory(req.validated.params.id)
    if (!deleted) {
      throw new HttpError(404, 'CATEGORY_NOT_FOUND', 'Category was not found')
    }

    return res.status(204).send()
  } catch (error) {
    return next(error)
  }
}
