import nodemailer from 'nodemailer'
import { config } from './env.js'

const isConfigured = Boolean(
  config.mail.host && config.mail.user && config.mail.password && config.mail.from,
)

const transport = isConfigured
  ? nodemailer.createTransport({
      host: config.mail.host,
      port: config.mail.port,
      secure: config.mail.port === 465,
      auth: {
        user: config.mail.user,
        pass: config.mail.password,
      },
    })
  : null

export const mailer = {
  isConfigured,
  async sendPasswordReset(to, token) {
    if (!transport) {
      throw new Error('SMTP password-reset delivery is not configured')
    }

    const resetUrl = new URL('/reset-password', config.mail.frontendOrigin)
    resetUrl.searchParams.set('token', token)

    await transport.sendMail({
      from: config.mail.from,
      to,
      subject: 'Reset your AI-GPMS password',
      text: `Use this one-time link within 30 minutes to reset your password: ${resetUrl.href}`,
    })
  },
}
