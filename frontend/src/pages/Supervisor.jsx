import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { get, post } from '../api'
import Spinner from '../components/Spinner'
import Badge from '../components/Badge'

export default function Supervisor() {
  const qc = useQueryClient()
  const navigate = useNavigate()

  const { data: stats } = useQuery({ queryKey: ['supervisor-stats'], queryFn: () => get('/supervisor/stats') })
  const { data: stuck = [], isLoading: ls } = useQuery({ queryKey: ['supervisor-stuck'], queryFn: () => get('/supervisor/stuck'), refetchInterval: 60_000 })
  const { data: overdue = [] } = useQuery({ queryKey: ['supervisor-overdue'], queryFn: () => get('/supervisor/overdue-approvals'), refetchInterval: 60_000 })
  const { data: inactive = [] } = useQuery({ queryKey: ['supervisor-inactive'], queryFn: () => get('/supervisor/inactive-leads') })

  const scan = useMutation({
    mutationFn: () => post('/supervisor/scan'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supervisor-stuck'] })
      qc.invalidateQueries({ queryKey: ['supervisor-overdue'] })
      qc.invalidateQueries({ queryKey: ['supervisor-inactive'] })
      qc.invalidateQueries({ queryKey: ['supervisor-stats'] })
    },
  })

  if (ls) return <Spinner />

  const statEntries = stats ? Object.entries(stats).filter(([, v]) => typeof v !== 'object') : []

  return (
    <div>
      <div className="page-header">
        <div><h1>Agent Supervisor</h1><p>Stuck work, overdue approvals, and inactive leads</p></div>
        <button className="btn btn-primary" onClick={() => scan.mutate()} disabled={scan.isPending}>
          {scan.isPending ? 'Scanning…' : 'Run Scan'}
        </button>
      </div>

      {scan.isSuccess && (
        <div style={{ background: 'var(--success-soft)', color: 'var(--success)', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 20 }}>
          Scan complete — escalated {scan.data?.escalated ?? 0} items
        </div>
      )}

      {statEntries.length > 0 && (
        <div className="stats-grid mb-4">
          {statEntries.map(([k, v]) => (
            <div key={k} className="card stat-card">
              <span className="stat-label">{k.replace(/_/g, ' ')}</span>
              <span className="stat-value" style={{ color: (k.includes('failed') || k.includes('stuck')) ? 'var(--danger)' : k.includes('completed') ? 'var(--success)' : undefined }}>
                {String(v)}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="three-col">
        <div className="card">
          <h3 className="font-semibold mb-4" style={{ fontSize: 14 }}>Stuck Runs ({stuck.length})</h3>
          {stuck.length === 0
            ? <p className="text-muted text-sm">All clear</p>
            : stuck.map(r => (
              <div key={r.id} className="flex items-center justify-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                onClick={() => navigate('/actions')}>
                <div>
                  <div className="text-sm font-medium">{r.action_name || r.action_key}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.id.slice(0, 8)}</div>
                </div>
                <Badge label={r.status} />
              </div>
            ))}
        </div>

        <div className="card">
          <h3 className="font-semibold mb-4" style={{ fontSize: 14 }}>Overdue Approvals ({overdue.length})</h3>
          {overdue.length === 0
            ? <p className="text-muted text-sm">None overdue</p>
            : overdue.map(a => (
              <div key={a.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                onClick={() => navigate('/approvals')}>
                <div className="text-sm font-medium">{a.title || `#${a.id.slice(0, 8)}`}</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Expires {a.expires_at ? new Date(a.expires_at).toLocaleDateString() : '—'}
                </div>
              </div>
            ))}
        </div>

        <div className="card">
          <h3 className="font-semibold mb-4" style={{ fontSize: 14 }}>Inactive Leads ({inactive.length})</h3>
          {inactive.length === 0
            ? <p className="text-muted text-sm">No inactive leads</p>
            : inactive.map(l => (
              <div key={l.id} className="flex items-center justify-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                onClick={() => navigate(`/crm/leads/${l.id}`)}>
                <div>
                  <div className="text-sm font-medium">{l.name}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>score {l.score}</div>
                </div>
                <Badge label={l.status} />
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}
