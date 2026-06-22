import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { LayoutDashboard, FolderOpen, Plus, Users, Zap } from 'lucide-react'
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

function WorkloadTab() {
  const qc = useQueryClient()
  const [showAllocate, setShowAllocate] = useState(false)
  const [form, setForm] = useState({ user_id: '', project_id: '', allocated_hours: '', week_start: '' })

  const { data: workload, isLoading } = useQuery({
    queryKey: ['pm-workload'],
    queryFn: () => get('/pm/workload'),
    retry: false,
  })

  const allocate = useMutation({
    mutationFn: () => post('/pm/workload', {
      user_id: form.user_id,
      project_id: form.project_id,
      allocated_hours: Number(form.allocated_hours),
      week_start: form.week_start,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pm-workload'] })
      setShowAllocate(false)
      setForm({ user_id: '', project_id: '', allocated_hours: '', week_start: '' })
    },
  })

  if (isLoading) return <Spinner />

  const allocations = workload?.allocations ?? []
  const summary = workload?.summary ?? {}

  return (
    <div>
      <div className="stats-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <span className="stat-label">total users</span>
          <span className="stat-value">{summary.total_users ?? 0}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">avg utilization</span>
          <span className="stat-value">{summary.avg_utilization != null ? `${Math.round(summary.avg_utilization)}%` : '—'}</span>
        </div>
      </div>

      <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Allocations</h2>
        <button className="btn btn-primary" onClick={() => setShowAllocate(true)}>
          Allocate
        </button>
      </div>

      {allocations.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No workload allocations"
          description="Allocate team members to projects to track utilization."
        />
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>User</th><th>Project</th><th>Allocated h</th><th>Actual h</th><th>Utilization</th><th>Week</th></tr>
              </thead>
              <tbody>
                {allocations.map((a, i) => {
                  const util = a.allocated_hours > 0 ? Math.min(Math.round((a.actual_hours / a.allocated_hours) * 100), 100) : 0
                  return (
                    <tr key={i}>
                      <td className="font-medium">{a.user_name || (a.user_id ? a.user_id.slice(0, 8) : '—')}</td>
                      <td className="td-muted">{a.project_id ? a.project_id.slice(0, 8) : '—'}</td>
                      <td>{a.allocated_hours ?? '—'}</td>
                      <td>{a.actual_hours ?? '—'}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="text-xs" style={{ color: 'var(--text-muted)', minWidth: 36 }}>{util}%</span>
                          <div style={{ background: 'var(--border-subtle)', borderRadius: 4, height: 8, overflow: 'hidden', minWidth: 80 }}>
                            <div style={{ width: `${util}%`, height: '100%', background: util > 90 ? 'var(--danger)' : 'var(--accent)', borderRadius: 4 }} />
                          </div>
                        </div>
                      </td>
                      <td className="td-muted">{a.week_start ? new Date(a.week_start).toLocaleDateString() : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={showAllocate}
        onClose={() => setShowAllocate(false)}
        title="Allocate Hours"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowAllocate(false)}>Cancel</button>
            <button
              className="btn btn-primary"
              disabled={!form.user_id.trim() || !form.project_id.trim() || !form.allocated_hours || allocate.isPending}
              onClick={() => allocate.mutate()}
            >
              {allocate.isPending ? 'Saving…' : 'Allocate'}
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">User ID *</label>
          <input className="form-input" autoFocus value={form.user_id} onChange={e => setForm(f => ({ ...f, user_id: e.target.value }))} placeholder="User UUID" />
        </div>
        <div className="form-group">
          <label className="form-label">Project ID *</label>
          <input className="form-input" value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))} placeholder="Project UUID" />
        </div>
        <div className="form-group">
          <label className="form-label">Allocated Hours *</label>
          <input type="number" className="form-input" value={form.allocated_hours} onChange={e => setForm(f => ({ ...f, allocated_hours: e.target.value }))} placeholder="e.g. 40" min="0" />
        </div>
        <div className="form-group">
          <label className="form-label">Week Start</label>
          <input type="date" className="form-input" value={form.week_start} onChange={e => setForm(f => ({ ...f, week_start: e.target.value }))} />
        </div>
        {allocate.isError && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{allocate.error?.message}</p>}
      </Modal>
    </div>
  )
}

const TRIGGER_OPTIONS = ['task_created', 'task_completed', 'sprint_started', 'sprint_ended', 'risk_added']

function AutomationTab() {
  const qc = useQueryClient()
  const [form, setForm] = useState({ name: '', trigger: 'task_created', conditions: '', actions: '' })
  const [saved, setSaved] = useState(false)

  const { data: rules } = useQuery({
    queryKey: ['pm-automation-rules'],
    queryFn: () => get('/pm/automation-rules'),
    retry: false,
  })

  const create = useMutation({
    mutationFn: () => {
      let conditions = form.conditions.trim() ? JSON.parse(form.conditions) : {}
      let actions = form.actions.trim() ? JSON.parse(form.actions) : []
      return post('/pm/automation-rules', { name: form.name, trigger: form.trigger, conditions, actions })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pm-automation-rules'] })
      setSaved(true)
      setForm({ name: '', trigger: 'task_created', conditions: '', actions: '' })
      setTimeout(() => setSaved(false), 3000)
    },
  })

  return (
    <div>
      <div className="card" style={{ marginBottom: 20, maxWidth: 560 }}>
        <h3 style={{ marginTop: 0, fontSize: 15 }}>Create Automation Rule</h3>
        <div className="form-group">
          <label className="form-label">Name *</label>
          <input
            className="form-input"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Notify on task complete"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Trigger</label>
          <select className="form-input" value={form.trigger} onChange={e => setForm(f => ({ ...f, trigger: e.target.value }))}>
            {TRIGGER_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Conditions (JSON)</label>
          <textarea
            className="form-input"
            rows={3}
            value={form.conditions}
            onChange={e => setForm(f => ({ ...f, conditions: e.target.value }))}
            placeholder='e.g. {"priority": "high"}'
            style={{ fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Actions (JSON)</label>
          <textarea
            className="form-input"
            rows={3}
            value={form.actions}
            onChange={e => setForm(f => ({ ...f, actions: e.target.value }))}
            placeholder='e.g. [{"type": "notify", "target": "owner"}]'
            style={{ fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }}
          />
        </div>
        {create.isError && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{create.error?.message}</p>}
        <div className="flex items-center gap-3">
          <button
            className="btn btn-primary"
            disabled={!form.name.trim() || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending ? 'Saving…' : 'Save Rule'}
          </button>
          {saved && <span style={{ fontSize: 13, color: 'var(--success)' }}>Rule saved successfully.</span>}
        </div>
      </div>

      {Array.isArray(rules) && rules.length > 0 && (
        <div className="card">
          <h3 style={{ marginTop: 0, fontSize: 15 }}>Existing Rules</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rules.map(r => (
              <div key={r.id} style={{ background: 'var(--bg-subtle)', borderRadius: 6, padding: '8px 12px', fontSize: 13 }}>
                <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
                  <span className="font-medium">{r.name}</span>
                  <Badge label={r.trigger} color="blue" />
                </div>
                <pre style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', overflow: 'auto' }}>
                  {JSON.stringify({ conditions: r.conditions, actions: r.actions }, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}
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

  const TABS = [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'portfolios', label: 'Portfolios', icon: FolderOpen },
    { key: 'workload', label: 'Workload', icon: Users },
    { key: 'automation', label: 'Automation', icon: Zap },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>PM Executive</h1>
          <p>Portfolio overview and project health</p>
        </div>
      </div>

      <div className="tab-bar" style={{ marginBottom: 20 }}>
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} className={`tab-item${tab === key ? ' active' : ''}`} onClick={() => setTab(key)}>
            <Icon size={14} style={{ display: 'inline', marginRight: 6 }} />{label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        lo ? <Spinner /> : <OverviewTab data={overviewData} />
      )}
      {tab === 'portfolios' && <PortfoliosTab />}
      {tab === 'workload' && <WorkloadTab />}
      {tab === 'automation' && <AutomationTab />}
    </div>
  )
}
