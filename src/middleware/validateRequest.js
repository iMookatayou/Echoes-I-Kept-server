import { HttpError } from '../utils/httpError.js'

export function validateRequest(schemas) {
  return (req, _res, next) => {
    const validated = {}
    const issues = []

    for (const location of ['params', 'query', 'body']) {
      const schema = schemas[location]
      if (!schema) continue

      const result = schema.safeParse(req[location])
      if (!result.success) {
        issues.push(
          ...result.error.issues.map((issue) => ({
            location,
            path: issue.path.join('.'),
            message: issue.message,
          })),
        )
      } else {
        validated[location] = result.data
      }
    }

    if (issues.length > 0) {
      return next(
        new HttpError(400, 'VALIDATION_ERROR', 'Request validation failed', issues),
      )
    }

    req.validated = validated
    return next()
  }
}
