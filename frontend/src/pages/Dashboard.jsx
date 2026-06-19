import { useQuery } from '@tanstack/react-query'
import { get } from '../api'
import Spinner from '../components/Spinner'
import Badge from '../components/Badge'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

function StatCard({ label, value, color }) {
  return (
    <div className="card stat-card">
      <span className="stat-label">{label.replace(/_/g, ' ')}</span>
      <span className="stat-value" style={color ? { color } : {}}>{value ?? '—'}</span>
    </div>
  )
}

export default function Dashboard() {
  const { data: overview, isLoading: lo } = useQuery({ queryKey: ['overview'], queryFn: () => get('/enterprise/overview') })
  const { data: brief } = useQuery({ queryKey: ['brief-latest'], queryFn: () => get('/daily-brief/latest'), retry: false })
  const { data: approvals = [] } = useQuery({ queryKey: ['approvals-pending'], queryFn: () => get('/approvals?status=pending&limit=5') })
  const { data: stuckRuns = [] } = useQuery({ queryKey: ['supervisor-stuck'], queryFn: () => get('/supervisor/stuck') })
  const { data: leads = [] } = useQuery({ queryKey: ['hot-leads'], queryFn: () => get('/leads?limit=5') })

  if (lo) return <Spinner />

  const stats = overview ? Object.entries(overview) : []

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Today's overview across CRM, PM, and agent activity</p>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        {stats.map(([k, v]) => (
          <StatCard key={k} label={k} value={typeof v === 'object' ? JSON.stringify(v) : String(v)} />
        ))}
      </div>

      <div className="grid-auto">
        {/* Pending approvals */}
        <div className="card">
          <h3 className="font-semibold mb-4" style={{ fontSize: 14 }}>Pending Approvals</h3>
          {approvals.length === 0
            ? <p className="text-muted text-sm">No pending approvals</p>
            : approvals.map(a => (
              <div key={a.id} className="flex items-center justify-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span className="text-sm">Action #{a.action_run_id?.slice(0, 8)}</span>
                <Badge label={a.status} />
              </div>
            ))}
        </div>

        {/* Stuck runs */}
        <div className="card">
          <h3 className="font-semibold mb-4" style={{ fontSize: 14 }}>Stuck Actions</h3>
          {stuckRuns.length === 0
            ? <p className="text-muted text-sm">All systems running smoothly</p>
            : stuckRuns.map(r => (
              <div key={r.id} className="flex items-center justify-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span className="text-sm font-medium">{r.action_key}</span>
                <Badge label={r.status} />
              </div>
            ))}
        </div>

        {/* Hot leads */}
        <div className="card">
          <h3 className="font-semibold mb-4" style={{ fontSize: 14 }}>Recent Leads</h3>
          {leads.length === 0
            ? <p className="text-muted text-sm">No leads yet</p>
            : leads.map(l => (
              <div key={l.id} className="flex items-center justify-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <div>
                  <div className="text-sm font-medium">{l.name}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{l.company}</div>
                </div>
                <div className="flex gap-2 items-center">
                  <Badge label={l.status} />
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>score {l.score}</span>
                </div>
              </div>
            ))}
        </div>

        {/* Daily brief summary */}
        {brief && (
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <h3 className="font-semibold mb-4" style={{ fontSize: 14 }}>Today's Brief — {new Date(brief.brief_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
            {brief.summary_text && <p className="text-sm" style={{ marginBottom: 16, color: 'var(--text-muted)' }}>{brief.summary_text}</p>}
            <div className="three-col">
              {Object.entries(brief.sections || {}).slice(0, 6).map(([key, val]) => (
                <div key={key} style={{ padding: '12px', background: 'var(--bg)', borderRadius: 8 }}>
                  <div className="text-xs font-semibold" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
                    {key.replace(/_/g, ' ')}
                  </div>
                  <div className="text-sm">
                    {Array.isArray(val)
                      ? <span className="font-semibold">{val.length} items</span>
                      : typeof val === 'object'
                        ? <pre style={{ fontSize: 11, margin: 0 }}>{JSON.stringify(val, null, 2)}</pre>
                        : <span className="font-semibold">{String(val)}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
