import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { post } from '../api'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState(token ? '' : 'Invalid or missing reset token.')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 10) {
      setError('Password must be at least 10 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    try {
      await post('/auth/reset-password', { token, password })
      setSuccess(true)
    } catch (err) {
      setError(err.message || 'Failed to reset password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <h1>MightyOps</h1>
          <p>Set new password</p>
        </div>
        {success ? (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>
              Password updated! You can now sign in.
            </p>
            <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={() => navigate('/login')}>
              Sign In →
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">New password</label>
              <input className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)} required disabled={!token} />
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Minimum 10 characters</p>
            </div>
            <div className="form-group">
              <label className="form-label">Confirm new password</label>
              <input className="form-input" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required disabled={!token} />
            </div>
            {error && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</p>}
            <button className="btn btn-primary" type="submit" disabled={loading || !token} style={{ marginTop: 4 }}>
              {loading ? 'Updating…' : 'Update password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
