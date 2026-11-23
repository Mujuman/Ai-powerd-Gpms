import jwt from 'jsonwebtoken'
import { config } from '../config/env.js'
import { findSessionUserById } from '../modules/users/users.repository.js'
import { HttpError } from '../utils/http-error.js'

export async function requireAuth(request, _response, next) {
  const authorization = request.get('authorization')
  const match = authorization?.match(/^Bearer ([^\s]+)$/i)
  if (!match) {
    next(new HttpError(401, 'Authentication required'))
    return
  }

  let claims
  try {
    claims = jwt.verify(match[1], config.jwtAccessSecret, {
      algorithms: ['HS256'],
      issuer: 'ai-gpms-api',
      audience: 'ai-gpms-web',
    })
  } catch {
    next(new HttpError(401, 'Invalid or expired access token'))
    return
  }

  if (typeof claims === 'string' || claims.type !== 'access' || !claims.sub) {
    next(new HttpError(401, 'Invalid or expired access token'))
    return
  }

  try {
    const user = await findSessionUserById(claims.sub)
    if (!user) {
      next(new HttpError(401, 'Account is inactive or unavailable'))
      return
    }
    request.user = user
    if (user.mustChangePassword
      && !(request.baseUrl === '/api/auth' && request.path === '/change-password')) {
      next(new HttpError(403, 'Change your initial password before continuing'))
      return
    }
    next()
  } catch (error) {
    next(error)
  }
}
