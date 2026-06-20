import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Sparkles } from 'lucide-react'
import { get, patch, post } from '../../api'
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

  const { data: project } = useQuery({ queryKey: ['project', id], queryFn: () => get(`/projects/${id}`) })
  const { data: kanban, isLoading } = useQuery({ queryKey: ['kanban', id], queryFn: () => get(`/projects/${id}/kanban`) })

  const moveTask = useMutation({
    mutationFn: ({ taskId, columnKey }) => patch(`/projects/${id}/kanban/tasks/${taskId}/move`, { column_key: columnKey }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kanban', id] }),
  })

  const createTask = useMutation({
    mutationFn: body => post(`/projects/${id}/tasks`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['kanban', id] }); setShowCreate(false); setForm({ title: '', priority: 'medium', column_key: 'ready' }) },
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

      {kanban
        ? <KanbanBoard columns={kanban.columns} renderCard={renderCard} />
        : <p className="text-muted">No board data.</p>
      }

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
    </div>
  )
}
