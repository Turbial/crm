import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle, XCircle } from 'lucide-react'
import { get } from '../api'
import { Spinner } from '../components'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) {
      setErrorMessage('No verification token provided.')
      setStatus('error')
      return
    }
    get('/auth/verify-email', { token })
      .then(() => setStatus('success'))
      .catch(err => {
        setErrorMessage(err.message || 'Verification failed.')
        setStatus('error')
      })
  }, [])

  return (
    <div className="login-page">
      <div className="login-card" style={{ textAlign: 'center' }}>
        {status === 'loading' && <Spinner />}
        {status === 'success' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <CheckCircle size={48} color="var(--success)" />
            <h2 style={{ margin: 0 }}>Email verified!</h2>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>
              Your account is active. You can now sign in.
            </p>
            <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={() => navigate('/login')}>
              Sign In →
            </button>
          </div>
        )}
        {status === 'error' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <XCircle size={48} color="var(--danger)" />
            <h2 style={{ margin: 0 }}>Verification failed</h2>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>{errorMessage}</p>
            <button className="btn btn-secondary" style={{ marginTop: 8 }} onClick={() => navigate('/forgot-password')}>
              Request new link →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
