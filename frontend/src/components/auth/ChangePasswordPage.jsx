import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, ROLE_HOME } from '../../contexts/AuthContext'
import { setAuth } from '../../lib/auth'
import api from '../../lib/api'
import { publishToast } from '../../lib/toastBus'

export default function ChangePasswordPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setError('')
    if (newPassword !== confirmation) {
      setError('The new passwords do not match')
      return
    }

    setIsSaving(true)
    try {
      const { data } = await api.post('/auth/change-password', {
        currentPassword,
        newPassword,
      })
      setAuth(data.data.user, data.data.accessToken)
      publishToast({ type: 'success', message: 'Operation successful.' })
      navigate(ROLE_HOME[data.data.user.role], { replace: true })
    } catch (requestError) {
      const response = requestError?.response?.data
      const details = Array.isArray(response?.errors)
        ? response.errors.map((detail) => (
          `${detail.path ? `${detail.path}: ` : ''}${detail.message}`
        ))
        : []
      publishToast({
        type: 'error',
        message: response?.message ?? 'Could not change your password',
        details,
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-card">
        <h1 className="auth-title">Change your password</h1>
        <p className="auth-subtitle">
          {user?.mustChangePassword
            ? 'Set a new password before continuing to your student workspace.'
            : 'Choose a new password for your account.'}
        </p>
        {error && <div className="form-error-banner" role="alert">{error}</div>}
        <form className="auth-form" onSubmit={submit}>
          <label className="form-field">
            <span className="form-label">Current or temporary password</span>
            <input className="form-input" type="password" autoComplete="current-password"
              required value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)} />
          </label>
          <label className="form-field">
            <span className="form-label">New password (at least 12 characters)</span>
            <input className="form-input" type="password" autoComplete="new-password"
              minLength={12} required value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)} />
          </label>
          <label className="form-field">
            <span className="form-label">Confirm new password</span>
            <input className="form-input" type="password" autoComplete="new-password"
              minLength={12} required value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)} />
          </label>
          <button className="btn-primary" disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save new password'}
          </button>
        </form>
      </section>
    </div>
  )
}
