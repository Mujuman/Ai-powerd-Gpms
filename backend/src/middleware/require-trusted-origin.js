import { config } from '../config/env.js'
import { HttpError } from '../utils/http-error.js'

export function requireTrustedOrigin(request, _response, next) {
  const origin = request.get('origin')
  if (origin && !config.frontendOrigins.includes(origin)) {
    next(new HttpError(403, 'Request origin is not allowed'))
    return
  }
  next()
}
