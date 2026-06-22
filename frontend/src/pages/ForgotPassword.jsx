import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { post } from '../api'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await post('/auth/forgot-password', { email })
      setSubmitted(true)
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <h1>MightyOps</h1>
          <p>Reset your password</p>
        </div>
        {submitted ? (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 32 }}>✉</div>
            <h2 style={{ margin: 0 }}>Check your inbox</h2>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>
              If that email is registered, we've sent a password reset link.<br />
              It expires in 1 hour.
            </p>
            <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={() => navigate('/login')}>
              Back to Sign In
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            {error && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</p>}
            <button className="btn btn-primary" type="submit" disabled={loading} style={{ marginTop: 4 }}>
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}
      </div>
      <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13 }}>
        <Link to="/login">← Back to sign in</Link>
      </p>
    </div>
  )
}
