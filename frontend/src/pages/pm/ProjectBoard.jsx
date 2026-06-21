import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Sparkles } from 'lucide-react'
import { get, patch, post } from '../../api'
import EmptyState from '../../components/EmptyState'
import Spinner from '../../components/Spinner'
import Badge from '../../components/Badge'
import KanbanBoard from '../../components/KanbanBoard'
import Modal from '../../components/Modal'
import AIScopeModal from '../../components/AIScopeModal'

const COLUMNS = ['ready', 'in_progress', 'review', 'done']
const PRIORITIES = ['low', 'medium', 'high', 'critical']

export default function ProjectBoard() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [showScope, setShowScope] = useState(false)
  const [form, setForm] = useState({ title: '', priority: 'medium', column_key: 'ready' })
  const [tab, setTab] = useState('board')

  const [showNewSprint, setShowNewSprint] = useState(false)
  const [sprintForm, setSprintForm] = useState({ name: '', goal: '', start_date: '', end_date: '' })

  const [showNewRisk, setShowNewRisk] = useState(false)
  const [riskForm, setRiskForm] = useState({ title: '', description: '', probability: 'low', impact: 'low' })

  const [showNewChange, setShowNewChange] = useState(false)
  const [changeForm, setChangeForm] = useState({ title: '', description: '', impact: 'low' })

  const { data: project } = useQuery({ queryKey: ['project', id], queryFn: () => get(`/projects/${id}`) })
  const { data: kanban, isLoading } = useQuery({ queryKey: ['kanban', id], queryFn: () => get(`/projects/${id}/kanban`) })

  const { data: sprints = [], isLoading: sprintsLoading } = useQuery({
    queryKey: ['sprints', id],
    queryFn: () => get(`/pm/projects/${id}/sprints`),
    enabled: tab === 'sprints',
  })

  const { data: risks = [], isLoading: risksLoading } = useQuery({
    queryKey: ['risks', id],
    queryFn: () => get(`/pm/projects/${id}/risks`),
    enabled: tab === 'risks',
  })

  const { data: changes = [], isLoading: changesLoading } = useQuery({
    queryKey: ['changes', id],
    queryFn: () => get(`/pm/projects/${id}/change-requests`),
    enabled: tab === 'changes',
  })

  const moveTask = useMutation({
    mutationFn: ({ taskId, columnKey }) => patch(`/projects/${id}/kanban/tasks/${taskId}/move`, { column_key: columnKey }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kanban', id] }),
  })

  const createTask = useMutation({
    mutationFn: body => post(`/projects/${id}/tasks`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['kanban', id] }); setShowCreate(false); setForm({ title: '', priority: 'medium', column_key: 'ready' }) },
  })

  const createSprint = useMutation({
    mutationFn: body => post(`/pm/projects/${id}/sprints`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sprints', id] }); setShowNewSprint(false); setSprintForm({ name: '', goal: '', start_date: '', end_date: '' }) },
  })

  const createRisk = useMutation({
    mutationFn: body => post(`/pm/projects/${id}/risks`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['risks', id] }); setShowNewRisk(false); setRiskForm({ title: '', description: '', probability: 'low', impact: 'low' }) },
  })

  const updateRiskStatus = useMutation({
    mutationFn: ({ riskId, status }) => patch(`/pm/projects/${id}/risks/${riskId}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['risks', id] }),
  })

  const createChange = useMutation({
    mutationFn: body => post(`/pm/projects/${id}/change-requests`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['changes', id] }); setShowNewChange(false); setChangeForm({ title: '', description: '', impact: 'low' }) },
  })

  if (isLoading) return <Spinner />

  function renderCard(task, column) {
    return (
      <div key={task.id} className="kanban-card">
        <div className="kanban-card-title">{task.title}</div>
        <div className="kanban-card-meta">
          <Badge label={task.priority || 'medium'} />
          {task.assignee_agent && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{task.assignee_agent}</span>}
        </div>
        {task.blocked_reason && (
          <div style={{ fontSize: 12, color: 'var(--warning)', marginTop: 6 }}>⚠ {task.blocked_reason}</div>
        )}
        <div className="flex gap-1 mt-4" style={{ flexWrap: 'wrap' }}>
          {COLUMNS.filter(c => c !== column.key).map(c => (
            <button key={c} className="btn btn-secondary btn-sm" onClick={() => moveTask.mutate({ taskId: task.id, columnKey: c })}>
              → {c.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button className="btn btn-ghost btn-icon" onClick={() => navigate('/pm/projects')}><ArrowLeft size={16} /></button>
        <h1 style={{ fontSize: 20, fontWeight: 700, flex: 1 }}>{project?.name || 'Project Board'}</h1>
        <button className="btn btn-secondary btn-sm flex gap-1 items-center" onClick={() => setShowScope(true)}>
          <Sparkles size={13} /> Scope with AI
        </button>
        <button className="btn btn-primary btn-sm flex gap-1 items-center" onClick={() => setShowCreate(true)}>
          <Plus size={13} /> New Task
        </button>
      </div>

      <div className="flex gap-2 items-center" style={{ marginBottom: 16 }}>
        {['board', 'sprints', 'risks', 'changes'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '4px 14px', borderRadius: 99, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
            background: tab === t ? 'var(--accent)' : 'var(--bg-subtle)',
            color: tab === t ? '#fff' : 'var(--text-muted)',
          }}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'board' && (
        kanban
          ? <KanbanBoard columns={kanban.columns} renderCard={renderCard} />
          : <p className="text-muted">No board data.</p>
      )}

      {tab === 'sprints' && (
        <div>
          <div className="flex gap-2 items-center" style={{ marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, flex: 1 }}>Sprints</h2>
            <button className="btn btn-primary btn-sm flex gap-1 items-center" onClick={() => setShowNewSprint(true)}>
              <Plus size={13} /> New Sprint
            </button>
          </div>
          {sprintsLoading ? <Spinner /> : sprints.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No sprints yet.</p>
          ) : (
            <div className="card" style={{ padding: 0 }}>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Sprint</th><th>Goal</th><th>Status</th><th>Dates</th></tr></thead>
                  <tbody>
                    {sprints.map(s => (
                      <tr key={s.id}>
                        <td style={{ fontWeight: 500 }}>{s.name}</td>
                        <td style={{ color: 'var(--text-muted)', fontSize: 13, maxWidth: 240 }}>
                          <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{s.goal || '—'}</span>
                        </td>
                        <td><Badge label={s.status || 'planning'} /></td>
                        <td className="td-muted">
                          {s.start_date ? new Date(s.start_date).toLocaleDateString() : '—'}
                          {s.end_date ? ` → ${new Date(s.end_date).toLocaleDateString()}` : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'risks' && (
        <div>
          <div className="flex gap-2 items-center" style={{ marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, flex: 1 }}>Risks</h2>
            <button className="btn btn-primary btn-sm flex gap-1 items-center" onClick={() => setShowNewRisk(true)}>
              <Plus size={13} /> New Risk
            </button>
          </div>
          {risksLoading ? <Spinner /> : risks.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No risks logged.</p>
          ) : (
            <div className="card" style={{ padding: 0 }}>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Title</th><th>Probability</th><th>Impact</th><th>Status</th></tr></thead>
                  <tbody>
                    {risks.map(r => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 500 }}>{r.title}</td>
                        <td><Badge label={r.probability || 'low'} /></td>
                        <td><Badge label={r.impact || 'low'} /></td>
                        <td>
                          <select
                            className="form-input"
                            value={r.status || 'open'}
                            onChange={e => updateRiskStatus.mutate({ riskId: r.id, status: e.target.value })}
                            style={{ padding: '2px 6px', fontSize: 12, width: 'auto' }}
                          >
                            {['open', 'mitigated', 'closed'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'changes' && (
        <div>
          <div className="flex gap-2 items-center" style={{ marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, flex: 1 }}>Change Requests</h2>
            <button className="btn btn-primary btn-sm flex gap-1 items-center" onClick={() => setShowNewChange(true)}>
              <Plus size={13} /> Request Change
            </button>
          </div>
          {changesLoading ? <Spinner /> : changes.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No change requests.</p>
          ) : (
            <div className="card" style={{ padding: 0 }}>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Title</th><th>Impact</th><th>Status</th><th>Created</th></tr></thead>
                  <tbody>
                    {changes.map(c => (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 500 }}>{c.title}</td>
                        <td><Badge label={c.impact || 'low'} /></td>
                        <td><Badge label={c.status || 'pending'} /></td>
                        <td className="td-muted">{c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Task"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={createTask.isPending || !form.title.trim()} onClick={() => createTask.mutate(form)}>
            {createTask.isPending ? 'Creating…' : 'Create'}
          </button>
        </>}>
        <div className="form-group">
          <label className="form-label">Title *</label>
          <input className="form-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Task title…" autoFocus />
        </div>
        <div className="form-group">
          <label className="form-label">Priority</label>
          <select className="form-input" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
            {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Start in column</label>
          <select className="form-input" value={form.column_key} onChange={e => setForm(f => ({ ...f, column_key: e.target.value }))}>
            {COLUMNS.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
          </select>
        </div>
        {createTask.isError && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{createTask.error?.message}</p>}
      </Modal>

      <AIScopeModal
        projectId={id}
        kanbanQueryKey={['kanban', id]}
        open={showScope}
        onClose={() => setShowScope(false)}
      />

      <Modal open={showNewSprint} onClose={() => setShowNewSprint(false)} title="New Sprint"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowNewSprint(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={createSprint.isPending || !sprintForm.name.trim()} onClick={() => createSprint.mutate(sprintForm)}>
            {createSprint.isPending ? 'Creating…' : 'Create'}
          </button>
        </>}>
        <div className="form-group">
          <label className="form-label">Sprint Name *</label>
          <input className="form-input" value={sprintForm.name} onChange={e => setSprintForm(f => ({ ...f, name: e.target.value }))} placeholder="Sprint 1" autoFocus />
        </div>
        <div className="form-group">
          <label className="form-label">Goal</label>
          <textarea className="form-input" rows={3} value={sprintForm.goal} onChange={e => setSprintForm(f => ({ ...f, goal: e.target.value }))} placeholder="What should this sprint achieve?" />
        </div>
        <div className="form-group">
          <label className="form-label">Start Date</label>
          <input className="form-input" type="date" value={sprintForm.start_date} onChange={e => setSprintForm(f => ({ ...f, start_date: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">End Date</label>
          <input className="form-input" type="date" value={sprintForm.end_date} onChange={e => setSprintForm(f => ({ ...f, end_date: e.target.value }))} />
        </div>
        {createSprint.isError && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{createSprint.error?.message}</p>}
      </Modal>

      <Modal open={showNewRisk} onClose={() => setShowNewRisk(false)} title="New Risk"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowNewRisk(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={createRisk.isPending || !riskForm.title.trim()} onClick={() => createRisk.mutate(riskForm)}>
            {createRisk.isPending ? 'Creating…' : 'Create'}
          </button>
        </>}>
        <div className="form-group">
          <label className="form-label">Title *</label>
          <input className="form-input" value={riskForm.title} onChange={e => setRiskForm(f => ({ ...f, title: e.target.value }))} placeholder="Risk title…" autoFocus />
        </div>
        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea className="form-input" rows={3} value={riskForm.description} onChange={e => setRiskForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe the risk…" />
        </div>
        <div className="form-group">
          <label className="form-label">Probability</label>
          <select className="form-input" value={riskForm.probability} onChange={e => setRiskForm(f => ({ ...f, probability: e.target.value }))}>
            {['low', 'medium', 'high'].map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Impact</label>
          <select className="form-input" value={riskForm.impact} onChange={e => setRiskForm(f => ({ ...f, impact: e.target.value }))}>
            {['low', 'medium', 'high', 'critical'].map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>)}
          </select>
        </div>
        {createRisk.isError && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{createRisk.error?.message}</p>}
      </Modal>

      <Modal open={showNewChange} onClose={() => setShowNewChange(false)} title="Request Change"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowNewChange(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={createChange.isPending || !changeForm.title.trim()} onClick={() => createChange.mutate(changeForm)}>
            {createChange.isPending ? 'Creating…' : 'Submit'}
          </button>
        </>}>
        <div className="form-group">
          <label className="form-label">Title *</label>
          <input className="form-input" value={changeForm.title} onChange={e => setChangeForm(f => ({ ...f, title: e.target.value }))} placeholder="Change request title…" autoFocus />
        </div>
        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea className="form-input" rows={3} value={changeForm.description} onChange={e => setChangeForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe the change…" />
        </div>
        <div className="form-group">
          <label className="form-label">Impact</label>
          <select className="form-input" value={changeForm.impact} onChange={e => setChangeForm(f => ({ ...f, impact: e.target.value }))}>
            {['low', 'medium', 'high'].map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>)}
          </select>
        </div>
        {createChange.isError && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{createChange.error?.message}</p>}
      </Modal>
    </div>
  )
}
