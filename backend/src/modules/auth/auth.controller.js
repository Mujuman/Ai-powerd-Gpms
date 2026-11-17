import { config } from '../../config/env.js'
import { authService } from './auth.service.js'

export const refreshCookieName = 'gpms_refresh'

const refreshCookieOptions = {
  httpOnly: true,
  secure: config.nodeEnv === 'production',
  sameSite: 'strict',
  path: '/api/auth',
  maxAge: config.refreshTokenTtlDays * 86400_000,
}
const clearRefreshCookieOptions = {
  httpOnly: refreshCookieOptions.httpOnly,
  secure: refreshCookieOptions.secure,
  sameSite: refreshCookieOptions.sameSite,
  path: refreshCookieOptions.path,
}

function requestInfo(request) {
  return { remoteAddress: request.socket.remoteAddress ?? null }
}

function setRefreshCookie(response, token) {
  response.cookie(refreshCookieName, token, refreshCookieOptions)
}

export function createAuthController(service = authService) {
  return {
    login: async (request, response) => {
      const session = await service.login(request.body, requestInfo(request))
      setRefreshCookie(response, session.refreshToken)
      response.json({
        success: true,
        message: 'Signed in successfully',
        data: {
          accessToken: session.accessToken,
          user: session.user,
        },
      })
    },

    refresh: async (request, response) => {
      const session = await service.refresh(
        request.cookies[refreshCookieName],
        requestInfo(request),
      )
      setRefreshCookie(response, session.refreshToken)
      response.json({
        success: true,
        message: 'Session refreshed',
        data: { accessToken: session.accessToken, user: session.user },
      })
    },

    logout: async (request, response) => {
      await service.logout(request.cookies[refreshCookieName], requestInfo(request))
      response.clearCookie(refreshCookieName, clearRefreshCookieOptions)
      response.status(204).end()
    },

    me: (request, response) => {
      response.json({ success: true, data: { user: request.user } })
    },

    changePassword: async (request, response) => {
      const session = await service.changePassword(
        request.user.id,
        request.body,
        requestInfo(request),
      )
      setRefreshCookie(response, session.refreshToken)
      response.json({
        success: true,
        message: 'Password changed successfully',
        data: {
          accessToken: session.accessToken,
          user: session.user,
        },
      })
    },

    requestPasswordReset: async (request, response) => {
      await service.requestPasswordReset(request.body.email, requestInfo(request))
      response.status(202).json({
        success: true,
        message: 'If the account exists, password reset instructions will be sent',
      })
    },

    confirmPasswordReset: async (request, response) => {
      await service.confirmPasswordReset(request.body, requestInfo(request))
      response.clearCookie(refreshCookieName, clearRefreshCookieOptions)
      response.json({ success: true, message: 'Password reset successfully' })
    },
  }
}
