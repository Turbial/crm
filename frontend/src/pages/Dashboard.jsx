import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { get } from '../api'
import Spinner from '../components/Spinner'
import Badge from '../components/Badge'

const STAT_LINKS = {
  leads: '/crm/leads',
  opportunities: '/crm/deals',
  projects: '/pm/projects',
  agent_actions: '/actions',
  automation_runs: '/actions',
  pm_open_tasks: '/pm/projects',
  pm_pending_approvals: '/approvals',
}

function StatCard({ label, value, navigate }) {
  const danger = ['failed', 'stuck', 'overdue'].some(k => label.includes(k))
  const success = ['completed', 'won'].some(k => label.includes(k))
  const link = STAT_LINKS[label]
  return (
    <div
      className="card stat-card"
      onClick={link ? () => navigate(link) : undefined}
      style={{ cursor: link ? 'pointer' : undefined }}
    >
      <span className="stat-label">{label.replace(/_/g, ' ')}</span>
      <span className="stat-value" style={{ color: danger ? 'var(--danger)' : success ? 'var(--success)' : undefined }}>
        {value ?? '—'}
      </span>
    </div>
  )
}

function BriefSection({ label, val }) {
  if (val == null) return null
  if (typeof val === 'number') return <span className="font-semibold">{val}</span>
  if (typeof val !== 'object') return <span className="font-semibold">{String(val)}</span>
  if (Array.isArray(val)) return <span className="font-semibold">{val.length} items</span>
  // object: show key-value pairs
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {Object.entries(val).map(([k, v]) => (
        <div key={k} className="flex justify-between" style={{ fontSize: 12 }}>
          <span style={{ color: 'var(--text-muted)' }}>{k.replace(/_/g, ' ')}</span>
          <span className="font-medium">{Array.isArray(v) ? v.length : String(v)}</span>
        </div>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { data: overview, isLoading: lo } = useQuery({ queryKey: ['overview'], queryFn: () => get('/enterprise/overview') })
  const { data: brief } = useQuery({ queryKey: ['brief-latest'], queryFn: () => get('/daily-brief/latest'), retry: false })
  const { data: approvals = [] } = useQuery({ queryKey: ['approvals-pending'], queryFn: () => get('/approvals', { status: 'pending', limit: 5 }), retry: false })
  const { data: stuckRuns = [] } = useQuery({ queryKey: ['supervisor-stuck'], queryFn: () => get('/supervisor/stuck'), retry: false })
  const { data: leads = [] } = useQuery({ queryKey: ['hot-leads'], queryFn: () => get('/leads', { limit: 5 }), retry: false })

  if (lo) return <Spinner />

  const stats = overview ? Object.entries(overview).filter(([, v]) => typeof v !== 'object') : []

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Today's overview across CRM, PM, and agent activity</p>
        </div>
      </div>

      <div className="stats-grid">
        {stats.map(([k, v]) => <StatCard key={k} label={k} value={String(v)} navigate={navigate} />)}
      </div>

      <div className="grid-auto">
        {/* Pending approvals */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold" style={{ fontSize: 14, margin: 0 }}>Pending Approvals</h3>
            <button className="btn btn-ghost btn-sm" style={{ fontSize: 12 }} onClick={() => navigate('/approvals')}>View all</button>
          </div>
          {approvals.length === 0
            ? <p className="text-muted text-sm">No pending approvals</p>
            : approvals.map(a => (
              <div key={a.id} className="flex items-center justify-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                onClick={() => navigate('/approvals')}>
                <div>
                  <div className="text-sm font-medium">{a.title || `Action #${a.action_run_id?.slice(0, 8)}`}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Risk: {a.risk_level || '—'}</div>
                </div>
                <Badge label={a.status} />
              </div>
            ))}
        </div>

        {/* Stuck runs */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold" style={{ fontSize: 14, margin: 0 }}>Stuck Actions</h3>
            <button className="btn btn-ghost btn-sm" style={{ fontSize: 12 }} onClick={() => navigate('/actions')}>View all</button>
          </div>
          {stuckRuns.length === 0
            ? <p className="text-muted text-sm">All systems running smoothly</p>
            : stuckRuns.map(r => (
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

        {/* Hot leads */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold" style={{ fontSize: 14, margin: 0 }}>Recent Leads</h3>
            <button className="btn btn-ghost btn-sm" style={{ fontSize: 12 }} onClick={() => navigate('/crm/leads')}>View all</button>
          </div>
          {leads.length === 0
            ? <p className="text-muted text-sm">No leads yet</p>
            : leads.map(l => (
              <div key={l.id} className="flex items-center justify-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                onClick={() => navigate(`/crm/leads/${l.id}`)}>
                <div>
                  <div className="text-sm font-medium">{l.name}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{l.company}</div>
                </div>
                <div className="flex gap-2 items-center">
                  <Badge label={l.status} />
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{l.score}</span>
                </div>
              </div>
            ))}
        </div>

        {/* Daily brief summary */}
        {brief && (
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <h3 className="font-semibold mb-4" style={{ fontSize: 14 }}>
              Today's Brief — {new Date(brief.brief_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </h3>
            {brief.summary_text && (
              <pre style={{ fontFamily: 'inherit', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', marginBottom: 16, color: 'var(--text-muted)' }}>
                {brief.summary_text}
              </pre>
            )}
            <div className="three-col">
              {Object.entries(brief.sections || {}).slice(0, 6).map(([key, val]) => (
                <div key={key} style={{ padding: 12, background: 'var(--bg)', borderRadius: 8 }}>
                  <div className="text-xs font-semibold" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                    {key.replace(/_/g, ' ')}
                  </div>
                  <BriefSection label={key} val={val} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
