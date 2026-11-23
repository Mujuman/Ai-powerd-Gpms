import { HttpError } from './http-error.js'

export function apiErrorHandler(error, _request, response, next) {
  if (response.headersSent) return next(error)
  const validStatus = Number.isInteger(error.status)
    && error.status >= 400
    && error.status <= 599
  const status = validStatus && (error.status < 500 || error instanceof HttpError)
    ? error.status
    : 500
  if (status === 500) console.error('Request failed:', error)
  response.status(status).json({
    success: false,
    message: status === 500 ? 'Internal server error' : error.message,
    ...(error.details ? { errors: error.details } : {}),
  })
}
