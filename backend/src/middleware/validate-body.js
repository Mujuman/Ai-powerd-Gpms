import { ZodError } from 'zod'
import { HttpError } from '../utils/http-error.js'

export function validateBody(schema) {
  return (request, _response, next) => {
    try {
      request.body = schema.parse(request.body)
      next()
    } catch (error) {
      if (error instanceof ZodError) {
        next(new HttpError(400, 'Validation failed', error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        }))))
        return
      }
      next(error)
    }
  }
}
