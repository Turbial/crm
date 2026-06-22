import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, CheckSquare } from 'lucide-react'
import { get, post, patch, del } from '../../api'
import Spinner from '../../components/Spinner'
import Badge from '../../components/Badge'
import EmptyState from '../../components/EmptyState'
import Modal from '../../components/Modal'

const STATUSES = ['open', 'in_progress', 'done', 'cancelled']
const PRIORITIES = ['low', 'medium', 'high', 'urgent']
const PRIORITY_COLORS = { low: 'gray', medium: 'blue', high: 'yellow', urgent: 'red' }
const STATUS_COLORS = { open: 'blue', in_progress: 'yellow', done: 'green', cancelled: 'gray' }

const fmtDate = d => d ? new Date(d).toLocaleString() : '—'

const EMPTY_FORM = { title: '', description: '', priority: 'medium', status: 'open', lead_id: '', due_date: '', assigned_to: '' }

export default function Tasks() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editForm, setEditForm] = useState(EMPTY_FORM)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => get('/tasks', { limit: 200 }),
  })

  const create = useMutation({
    mutationFn: body => post('/tasks', {
      title: body.title,
      lead_id: body.lead_id || undefined,
      description: body.description || undefined,
      status: body.status,
      priority: body.priority,
      due_date: body.due_date || undefined,
      assigned_to: body.assigned_to || undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); setShowCreate(false); setForm(EMPTY_FORM) },
  })

  const update = useMutation({
    mutationFn: body => patch(`/tasks/${selected.id}`, {
      title: body.title,
      status: body.status,
      priority: body.priority,
      due_date: body.due_date || undefined,
      description: body.description || undefined,
      assigned_to: body.assigned_to || undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); setSelected(null) },
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, status }) => patch(`/tasks/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })

  const remove = useMutation({
    mutationFn: () => del(`/tasks/${selected.id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); setSelected(null) },
  })

  const now = new Date()
  const filtered = tasks
    .filter(t => !statusFilter || t.status === statusFilter)
    .filter(t => !priorityFilter || t.priority === priorityFilter)
    .filter(t => !debouncedSearch || t.title?.toLowerCase().includes(debouncedSearch.toLowerCase()))

  const overdueCount = tasks.filter(t =>
    t.due_date && !['done', 'cancelled'].includes(t.status) && new Date(t.due_date) < now
  ).length

  function openEdit(t) {
    setSelected(t)
    setEditForm({
      title: t.title || '',
      description: t.description || '',
      priority: t.priority || 'medium',
      status: t.status || 'open',
      lead_id: t.lead_id || '',
      due_date: t.due_date ? t.due_date.slice(0, 10) : '',
      assigned_to: t.assigned_to || '',
    })
  }

  function isPastDue(t) {
    return t.due_date && !['done', 'cancelled'].includes(t.status) && new Date(t.due_date) < now
  }

  if (isLoading) return <Spinner />

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Tasks</h1>
          <p style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {filtered.length} tasks
            {overdueCount > 0 && (
              <span className="badge badge-red">{overdueCount} overdue</span>
            )}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              className="form-input"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search tasks…"
              style={{ width: 200, paddingLeft: 32 }}
            />
          </div>
          <select className="form-input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: 150 }}>
            <option value="">All statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
          <select className="form-input" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} style={{ width: 140 }}>
            <option value="">All priorities</option>
            {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
          </select>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}><Plus size={15} /> New Task</button>
        </div>
      </div>

      {filtered.length === 0
        ? <EmptyState icon={CheckSquare} title="No tasks yet" description="Stay on top of your work by creating your first task." action={<button className="btn btn-primary" onClick={() => setShowCreate(true)}>Create task</button>} />
        : (
          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Title</th><th>Priority</th><th>Status</th><th>Due Date</th><th>Lead ID</th><th>Assigned To</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(t => (
                    <tr key={t.id} style={{ cursor: 'pointer' }} onClick={e => { if (e.target.tagName === 'SELECT') return; openEdit(t) }}>
                      <td className="font-medium text-sm">{t.title}</td>
                      <td><Badge label={t.priority} color={PRIORITY_COLORS[t.priority]} /></td>
                      <td><Badge label={t.status} color={STATUS_COLORS[t.status]} /></td>
                      <td>
                        <span style={{ color: isPastDue(t) ? 'var(--danger)' : undefined, fontWeight: isPastDue(t) ? 600 : undefined }}>
                          {t.due_date ? new Date(t.due_date).toLocaleDateString() : '—'}
                        </span>
                      </td>
                      <td className="td-muted">{t.lead_id ? String(t.lead_id).slice(0, 8) : '—'}</td>
                      <td className="td-muted">{t.assigned_to || '—'}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <select
                          className="form-input"
                          style={{ width: 130, padding: '3px 6px', fontSize: 12 }}
                          value={t.status}
                          onChange={e => updateStatus.mutate({ id: t.id, status: e.target.value })}
                        >
                          {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      <Modal open={showCreate} onClose={() => { setShowCreate(false); setForm(EMPTY_FORM) }} title="New Task"
        footer={<>
          <button className="btn btn-secondary" onClick={() => { setShowCreate(false); setForm(EMPTY_FORM) }}>Cancel</button>
          <button className="btn btn-primary" disabled={create.isPending || !form.title.trim()} onClick={() => create.mutate(form)}>
            {create.isPending ? 'Creating…' : 'Create'}
          </button>
        </>}>
        <TaskForm form={form} setForm={setForm} />
        {create.isError && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{create.error.message}</p>}
      </Modal>

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Edit Task"
        footer={<>
          <button className="btn btn-danger btn-sm" disabled={remove.isPending} onClick={() => remove.mutate()}>
            {remove.isPending ? 'Deleting…' : 'Delete'}
          </button>
          <div className="flex gap-2 items-center">
            <button className="btn btn-secondary" onClick={() => setSelected(null)}>Cancel</button>
            <button className="btn btn-primary" disabled={update.isPending || !editForm.title.trim()} onClick={() => update.mutate(editForm)}>
              {update.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </>}>
        <TaskForm form={editForm} setForm={setEditForm} />
        {update.isError && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{update.error.message}</p>}
        {remove.isError && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{remove.error.message}</p>}
      </Modal>
    </div>
  )
}

function TaskForm({ form, setForm }) {
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  return (
    <>
      <div className="form-group">
        <label className="form-label">Title *</label>
        <input className="form-input" value={form.title} onChange={e => set('title', e.target.value)} placeholder="Task title" />
      </div>
      <div className="form-group">
        <label className="form-label">Description</label>
        <textarea className="form-input" rows={3} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Task description…" />
      </div>
      <div className="form-group">
        <label className="form-label">Priority</label>
        <select className="form-input" value={form.priority} onChange={e => set('priority', e.target.value)}>
          {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Status</label>
        <select className="form-input" value={form.status} onChange={e => set('status', e.target.value)}>
          {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Lead ID</label>
        <input className="form-input" value={form.lead_id} onChange={e => set('lead_id', e.target.value)} placeholder="Lead ID" />
      </div>
      <div className="form-group">
        <label className="form-label">Due Date</label>
        <input className="form-input" type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
      </div>
      <div className="form-group">
        <label className="form-label">Assigned To</label>
        <input className="form-input" value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)} placeholder="Name or email" />
      </div>
    </>
  )
}
