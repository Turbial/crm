import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { FolderOpen, Plus, Sparkles, X } from 'lucide-react'
import { get, post } from '../../api'
import Spinner from '../../components/Spinner'
import Badge from '../../components/Badge'
import EmptyState from '../../components/EmptyState'
import Modal from '../../components/Modal'

const STATUS_OPTIONS = ['', 'active', 'completed', 'on_hold', 'cancelled']
const TYPE_OPTIONS = ['custom', 'website', 'app_development', 'marketing', 'crm_setup', 'operations']
const STATUS_BADGE = { active: 'blue', completed: 'green', on_hold: 'yellow', cancelled: 'gray' }

function NewProjectModal({ open, onClose, onCreated }) {
  const [mode, setMode] = useState('manual') // 'manual' | 'ai'
  const [form, setForm] = useState({ name: '', project_type: 'custom', goal: '', description: '' })
  const [aiDesc, setAiDesc] = useState('')

  const createManual = useMutation({
    mutationFn: () => post('/projects', { name: form.name, project_type: form.project_type, goal: form.goal }),
    onSuccess: p => { onCreated(p.id); onClose() },
  })

  const generateAI = useMutation({
    mutationFn: () => post('/projects/generate', {
      name: form.name,
      project_type: form.project_type,
      goal: aiDesc,
      auto_queue_openclaw: false,
    }),
    onSuccess: r => { onCreated(r.project.id); onClose() },
  })

  if (!open) return null

  const isPending = createManual.isPending || generateAI.isPending
  const error = createManual.error || generateAI.error

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h2>New Project</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          {/* Mode toggle */}
          <div className="tab-bar" style={{ marginBottom: 4 }}>
            <button className={`tab-item${mode === 'manual' ? ' active' : ''}`} onClick={() => setMode('manual')}>Manual</button>
            <button className={`tab-item${mode === 'ai' ? ' active' : ''}`} onClick={() => setMode('ai')}>
              <Sparkles size={12} style={{ display: 'inline', marginRight: 4 }} />Generate with AI
            </button>
          </div>

          <div className="form-group">
            <label className="form-label">Project Name *</label>
            <input
              className="form-input"
              autoFocus
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. New Company Website"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Type</label>
            <select className="form-input" value={form.project_type} onChange={e => setForm(f => ({ ...f, project_type: e.target.value }))}>
              {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
            </select>
          </div>

          {mode === 'manual' ? (
            <div className="form-group">
              <label className="form-label">Goal / Description</label>
              <textarea
                className="form-input"
                rows={3}
                value={form.goal}
                onChange={e => setForm(f => ({ ...f, goal: e.target.value }))}
                placeholder="What should this project achieve?"
                style={{ resize: 'vertical' }}
              />
            </div>
          ) : (
            <div className="form-group">
              <label className="form-label">Describe the project</label>
              <textarea
                className="form-input"
                rows={4}
                value={aiDesc}
                onChange={e => setAiDesc(e.target.value)}
                placeholder="Describe what you need in plain language. AI will generate milestones and tasks automatically."
                style={{ resize: 'vertical' }}
              />
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                AI will break this into milestones and tasks on the Kanban board.
              </p>
            </div>
          )}

          {error && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{error.message}</p>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={!form.name.trim() || isPending || (mode === 'ai' && !aiDesc.trim())}
            onClick={() => mode === 'manual' ? createManual.mutate() : generateAI.mutate()}
          >
            {isPending ? (mode === 'ai' ? 'Generating…' : 'Creating…') : (mode === 'ai' ? 'Generate Project' : 'Create Project')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Projects() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [status, setStatus] = useState('')
  const [showNew, setShowNew] = useState(false)

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects', status],
    queryFn: () => get('/projects', { ...(status ? { status } : {}), limit: 200 }),
  })

  if (isLoading) return <Spinner />

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Projects</h1>
          <p>{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2 items-center">
          <select
            className="form-input"
            value={status}
            onChange={e => setStatus(e.target.value)}
            style={{ width: 150, fontSize: 13 }}
          >
            {STATUS_OPTIONS.map(s => (
              <option key={s} value={s}>{s ? s.replace('_', ' ') : 'All statuses'}</option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={() => setShowNew(true)}>
            <Plus size={15} /> New Project
          </button>
        </div>
      </div>

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No projects yet"
          description="Create a project manually or let AI generate milestones and tasks for you."
          action={<button className="btn btn-primary" onClick={() => setShowNew(true)}>New Project</button>}
        />
      ) : (
        <div className="grid-auto">
          {projects.map(p => (
            <Link key={p.id} to={`/pm/projects/${p.id}`} style={{ textDecoration: 'none' }}>
              <div
                className="card"
                style={{ cursor: 'pointer', transition: 'box-shadow .15s' }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = 'var(--shadow)'}
              >
                <div className="flex items-center justify-between mb-4">
                  <FolderOpen size={18} color="var(--accent)" />
                  <Badge label={p.status || 'active'} color={STATUS_BADGE[p.status] || 'gray'} />
                </div>
                <h3 className="font-semibold" style={{ fontSize: 15, marginBottom: 6 }}>{p.name}</h3>
                {p.goal && <p className="text-sm text-muted truncate" style={{ marginBottom: 8 }}>{p.goal}</p>}
                <div className="flex gap-3" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {p.project_type && p.project_type !== 'custom' && (
                    <span>{p.project_type.replace('_', ' ')}</span>
                  )}
                  {p.due_at && <span>Due {new Date(p.due_at).toLocaleDateString()}</span>}
                  {p.start_date && !p.due_at && <span>Started {new Date(p.start_date).toLocaleDateString()}</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <NewProjectModal
        open={showNew}
        onClose={() => setShowNew(false)}
        onCreated={id => { qc.invalidateQueries({ queryKey: ['projects'] }); navigate(`/pm/projects/${id}`) }}
      />
    </div>
  )
}
