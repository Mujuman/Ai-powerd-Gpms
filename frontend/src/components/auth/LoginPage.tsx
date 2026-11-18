import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { GraduationCap } from 'lucide-react'
import * as z from 'zod'
import { useAuth } from '../../contexts/AuthContext'

// ── Zod schema (manual parse — @hookform/resolvers not installed) ──────────
const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})
type LoginFormValues = z.infer<typeof loginSchema>

// ── Component ─────────────────────────────────────────────────────────────
export default function LoginPage() {
  const { login } = useAuth()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<LoginFormValues>({ mode: 'onBlur' })

  async function onSubmit(raw: LoginFormValues) {
    setServerError(null)

    // Client-side validation via Zod
    const result = loginSchema.safeParse(raw)
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors
      if (fieldErrors.email?.[0]) setError('email', { message: fieldErrors.email[0] })
      if (fieldErrors.password?.[0]) setError('password', { message: fieldErrors.password[0] })
      return
    }

    try {
      await login(result.data.email, result.data.password)
      // navigation is handled inside login()
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Invalid email or password'
      setServerError(msg)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Brand */}
        <div className="auth-brand" aria-label="AI-GPMS">
          <span className="brand-mark">
            <GraduationCap size={22} />
          </span>
          <span className="auth-brand-name">AI-GPMS</span>
        </div>

        <h1 className="auth-title">Sign in to your account</h1>
        <p className="auth-subtitle">Graduation Project Management System</p>

        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          aria-label="Login form"
          className="auth-form"
        >
          {/* Server-level error */}
          {serverError && (
            <div className="form-error-banner" role="alert">
              {serverError}
            </div>
          )}

          {/* Email */}
          <div className="form-field">
            <label htmlFor="email" className="form-label">
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              aria-describedby={errors.email ? 'email-error' : undefined}
              aria-invalid={!!errors.email}
              className={`form-input ${errors.email ? 'is-invalid' : ''}`}
              {...register('email')}
            />
            {errors.email && (
              <p id="email-error" className="form-field-error" role="alert">
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Password */}
          <div className="form-field">
            <label htmlFor="password" className="form-label">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              aria-describedby={errors.password ? 'password-error' : undefined}
              aria-invalid={!!errors.password}
              className={`form-input ${errors.password ? 'is-invalid' : ''}`}
              {...register('password')}
            />
            {errors.password && (
              <p id="password-error" className="form-field-error" role="alert">
                {errors.password.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary w-full mt-2"
            aria-busy={isSubmitting}
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
