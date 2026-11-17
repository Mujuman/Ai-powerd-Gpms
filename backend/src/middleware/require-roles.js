import { HttpError } from '../utils/http-error.js'

export const supportedRoles = Object.freeze([
  'system_administrator',
  'department_head',
  'academic_advisor',
  'examiner',
  'student',
])

export function requireRoles(...roles) {
  const invalidRoles = roles.filter((role) => !supportedRoles.includes(role))
  if (invalidRoles.length > 0) {
    throw new Error(`Unsupported login role configured: ${invalidRoles.join(', ')}`)
  }

  return (request, _response, next) => {
    if (!request.user) {
      next(new HttpError(401, 'Authentication required'))
      return
    }
    if (!roles.includes(request.user.role)) {
      next(new HttpError(403, 'You do not have permission to access this resource'))
      return
    }
    next()
  }
}
