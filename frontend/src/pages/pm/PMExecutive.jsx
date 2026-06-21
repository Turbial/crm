import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { LayoutDashboard, FolderOpen, Plus } from 'lucide-react'
import { get, post } from '../../api'
import Spinner from '../../components/Spinner'
import Badge from '../../components/Badge'
import EmptyState from '../../components/EmptyState'
import Modal from '../../components/Modal'

const fmtCurrency = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

const HEALTH_COLOR = { on_track: 'green', at_risk: 'yellow', off_track: 'red' }

function ProgressBar({ value, max, color = 'var(--accent)' }) {
  const pct = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0
  return (
    <div style={{ background: 'var(--border-subtle)', borderRadius: 4, height: 8, overflow: 'hidden', minWidth: 80 }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width .3s' }} />
    </div>
  )
}

function OverviewTab({ data }) {
  const total_projects = data?.total_projects ?? 0
  const active_projects = data?.active_projects ?? 0
  const overdue_tasks = data?.overdue_tasks ?? 0
  const at_risk_projects = data?.at_risk_projects ?? 0
  const total_budget = data?.total_budget ?? 0
  const spent_budget = data?.spent_budget ?? 0
  const utilization_pct = data?.utilization_pct ?? 0
  const projects = data?.projects ?? []

  return (
    <div>
      <div className="stats-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <span className="stat-label">total projects</span>
          <span className="stat-value">{total_projects}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">active projects</span>
          <span className="stat-value" style={{ color: 'var(--success)' }}>{active_projects}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">overdue tasks</span>
          <span className="stat-value" style={{ color: overdue_tasks > 0 ? 'var(--danger)' : undefined }}>{overdue_tasks}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">at risk projects</span>
          <span className="stat-value" style={{ color: at_risk_projects > 0 ? 'var(--warning, var(--danger))' : undefined }}>{at_risk_projects}</span>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
          <span className="font-medium text-sm">Budget Utilization</span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {fmtCurrency(spent_budget)} of {fmtCurrency(total_budget)} · {utilization_pct}%
          </span>
        </div>
        <ProgressBar value={spent_budget} max={total_budget || 1} color={utilization_pct > 90 ? 'var(--danger)' : 'var(--accent)'} />
      </div>

      {projects.length === 0 ? (
        <div className="card">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No projects found</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Status</th>
                  <th>Health</th>
                  <th>Tasks</th>
                  <th>Budget</th>
                </tr>
              </thead>
              <tbody>
                {projects.map(p => {
                  const tasksDone = p.tasks_done ?? 0
                  const tasksTotal = p.tasks_total ?? 0
                  const spent = p.spent ?? 0
                  const budget = p.budget ?? 0
                  return (
                    <tr key={p.id}>
                      <td className="font-medium">{p.name ?? '—'}</td>
                      <td><Badge label={p.status ?? 'active'} /></td>
                      <td><Badge label={p.health ?? '—'} color={HEALTH_COLOR[p.health] ?? 'gray'} /></td>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="text-xs" style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {tasksDone}/{tasksTotal}
                          </span>
                          <ProgressBar value={tasksDone} max={tasksTotal || 1} />
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="text-xs" style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {fmtCurrency(spent)} / {fmtCurrency(budget)}
                          </span>
                          <ProgressBar value={spent} max={budget || 1} color={budget > 0 && spent / budget > 0.9 ? 'var(--danger)' : 'var(--accent)'} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function PortfoliosTab() {
  const qc = useQueryClient()
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ name: '', description: '' })

  const { data: portfolios = [], isLoading } = useQuery({
    queryKey: ['pm-portfolios'],
    queryFn: () => get('/pm/portfolios'),
  })

  const create = useMutation({
    mutationFn: () => post('/pm/portfolios', { name: form.name.trim(), description: form.description.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pm-portfolios'] })
      setShowNew(false)
      setForm({ name: '', description: '' })
    },
  })

  if (isLoading) return <Spinner />

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{portfolios.length} portfolio{portfolios.length !== 1 ? 's' : ''}</span>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}>
          <Plus size={15} /> New Portfolio
        </button>
      </div>

      {portfolios.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No portfolios yet"
          description="Group projects into portfolios for executive oversight."
          action={<button className="btn btn-primary" onClick={() => setShowNew(true)}>New Portfolio</button>}
        />
      ) : (
        <div className="grid-auto">
          {portfolios.map(p => (
            <div key={p.id} className="card">
              <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                <h3 className="font-semibold" style={{ fontSize: 15, margin: 0 }}>{p.name}</h3>
                <span
                  style={{
                    background: 'var(--accent-soft, var(--bg))',
                    color: 'var(--accent)',
                    borderRadius: 12,
                    padding: '2px 8px',
                    fontSize: 12,
                    fontWeight: 600,
                    border: '1px solid var(--accent)',
                  }}
                >
                  {p.project_count ?? 0} project{(p.project_count ?? 0) !== 1 ? 's' : ''}
                </span>
              </div>
              {p.description && (
                <p className="text-sm" style={{ color: 'var(--text-muted)', marginBottom: 12 }}>{p.description}</p>
              )}
              <button className="btn btn-secondary btn-sm" disabled style={{ marginTop: 4 }}>
                View projects
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={showNew}
        onClose={() => { setShowNew(false); setForm({ name: '', description: '' }) }}
        title="New Portfolio"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => { setShowNew(false); setForm({ name: '', description: '' }) }}>Cancel</button>
            <button
              className="btn btn-primary"
              disabled={!form.name.trim() || create.isPending}
              onClick={() => create.mutate()}
            >
              {create.isPending ? 'Creating…' : 'Create'}
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Portfolio Name *</label>
          <input
            className="form-input"
            autoFocus
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Q3 Growth Initiatives"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea
            className="form-input"
            rows={3}
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="What does this portfolio cover?"
            style={{ resize: 'vertical' }}
          />
        </div>
        {create.isError && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{create.error.message}</p>}
      </Modal>
    </div>
  )
}

export default function PMExecutive() {
  const [tab, setTab] = useState('overview')

  const { data: overviewData, isLoading: lo } = useQuery({
    queryKey: ['pm-executive-overview'],
    queryFn: () => get('/pm/executive-overview'),
    retry: false,
  })

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>PM Executive</h1>
          <p>Portfolio overview and project health</p>
        </div>
      </div>

      <div className="tab-bar" style={{ marginBottom: 20 }}>
        <button className={`tab-item${tab === 'overview' ? ' active' : ''}`} onClick={() => setTab('overview')}>
          <LayoutDashboard size={14} style={{ display: 'inline', marginRight: 6 }} />Overview
        </button>
        <button className={`tab-item${tab === 'portfolios' ? ' active' : ''}`} onClick={() => setTab('portfolios')}>
          <FolderOpen size={14} style={{ display: 'inline', marginRight: 6 }} />Portfolios
        </button>
      </div>

      {tab === 'overview' && (
        lo ? <Spinner /> : <OverviewTab data={overviewData} />
      )}
      {tab === 'portfolios' && <PortfoliosTab />}
    </div>
  )
}
