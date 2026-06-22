import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { post } from '../api'

export default function Signup() {
  const [orgName, setOrgName] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
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
      await post('/auth/register', { org_name: orgName, name, email, password })
      setSubmitted(true)
    } catch (err) {
      setError(err.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <h1>MightyOps</h1>
          <p>Create your account</p>
        </div>
        {submitted ? (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 32 }}>✉</div>
            <h2 style={{ margin: 0 }}>Check your inbox</h2>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>
              We sent a verification link to <strong>{email}</strong>.<br />
              Click it to activate your account, then come back to sign in.
            </p>
            <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={() => navigate('/login')}>
              Back to Sign In
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Company / Organization name</label>
              <input className="form-input" type="text" value={orgName} onChange={e => setOrgName(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Your full name</label>
              <input className="form-input" type="text" value={name} onChange={e => setName(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Work email</label>
              <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={10} />
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Minimum 10 characters</p>
            </div>
            <div className="form-group">
              <label className="form-label">Confirm password</label>
              <input className="form-input" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
            </div>
            {error && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</p>}
            <button className="btn btn-primary" type="submit" disabled={loading} style={{ marginTop: 4 }}>
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        )}
      </div>
      <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: 'var(--text-muted)' }}>
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </div>
  )
}
