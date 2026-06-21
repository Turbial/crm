import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { FolderOpen, Plus, Sparkles, X, Layout } from 'lucide-react'
import { get, post } from '../../api'
import Spinner from '../../components/Spinner'
import Badge from '../../components/Badge'
import EmptyState from '../../components/EmptyState'
import Modal from '../../components/Modal'

const STATUS_OPTIONS = ['', 'active', 'completed', 'on_hold', 'cancelled']
const TYPE_OPTIONS = ['custom', 'website', 'app_development', 'marketing', 'crm_setup', 'operations']
const STATUS_BADGE = { active: 'blue', completed: 'green', on_hold: 'yellow', cancelled: 'gray' }

function NewProjectModal({ open, onClose, onCreated }) {
  const [mode, setMode] = useState('manual')
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

function ProjectsTab({ onNew }) {
  const [status, setStatus] = useState('')

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects', status],
    queryFn: () => get('/projects', { ...(status ? { status } : {}), limit: 200 }),
  })

  if (isLoading) return <Spinner />

  return (
    <div>
      <div className="flex gap-2 items-center" style={{ justifyContent: 'flex-end', marginBottom: 16 }}>
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
        <button className="btn btn-primary" onClick={onNew}>
          <Plus size={15} /> New Project
        </button>
      </div>

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No projects yet"
          description="Create a project manually or let AI generate milestones and tasks for you."
          action={<button className="btn btn-primary" onClick={onNew}>New Project</button>}
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
    </div>
  )
}

function TemplatesTab() {
  const qc = useQueryClient()
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ name: '', project_type: 'custom', description: '' })

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['project-templates'],
    queryFn: () => get('/projects/templates'),
    retry: false,
  })

  const create = useMutation({
    mutationFn: () => post('/projects/templates', { name: form.name, project_type: form.project_type, description: form.description }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-templates'] })
      setShowNew(false)
      setForm({ name: '', project_type: 'custom', description: '' })
    },
  })

  const loadDefaults = useMutation({
    mutationFn: () => post('/projects/templates/defaults', {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-templates'] }),
  })

  if (isLoading) return <Spinner />

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
        <span />
        <div className="flex gap-2">
          <button
            className="btn btn-secondary"
            onClick={() => loadDefaults.mutate()}
            disabled={loadDefaults.isPending}
          >
            {loadDefaults.isPending ? 'Loading…' : 'Load Defaults'}
          </button>
          <button className="btn btn-primary" onClick={() => setShowNew(true)}>
            <Plus size={15} /> New Template
          </button>
        </div>
      </div>

      {templates.length === 0 ? (
        <EmptyState
          icon={Layout}
          title="No templates yet"
          description="Create reusable project templates or load the built-in defaults."
          action={
            <div className="flex gap-2">
              <button className="btn btn-secondary" onClick={() => loadDefaults.mutate()} disabled={loadDefaults.isPending}>Load Defaults</button>
              <button className="btn btn-primary" onClick={() => setShowNew(true)}>New Template</button>
            </div>
          }
        />
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Name</th><th>Type</th><th>Description</th><th>Created</th></tr>
              </thead>
              <tbody>
                {templates.map(t => (
                  <tr key={t.id}>
                    <td className="font-medium">{t.name}</td>
                    <td><Badge label={t.project_type || 'custom'} color="blue" /></td>
                    <td className="td-muted" style={{ maxWidth: 300 }}>
                      <span style={{ display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {t.description ? t.description.slice(0, 60) + (t.description.length > 60 ? '…' : '') : '—'}
                      </span>
                    </td>
                    <td className="td-muted">{t.created_at ? new Date(t.created_at).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={showNew}
        onClose={() => setShowNew(false)}
        title="New Template"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowNew(false)}>Cancel</button>
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
          <label className="form-label">Name *</label>
          <input
            className="form-input"
            autoFocus
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Website Launch Template"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Project Type</label>
          <select className="form-input" value={form.project_type} onChange={e => setForm(f => ({ ...f, project_type: e.target.value }))}>
            {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea
            className="form-input"
            rows={3}
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Describe this template…"
            style={{ resize: 'vertical' }}
          />
        </div>
        {create.isError && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{create.error?.message}</p>}
      </Modal>
    </div>
  )
}

export default function Projects() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [tab, setTab] = useState('Projects')
  const [showNew, setShowNew] = useState(false)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Projects</h1>
        </div>
      </div>

      <div className="flex gap-0" style={{ borderBottom: '1px solid var(--border-subtle)', marginBottom: 24 }}>
        {['Projects', 'Templates'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="btn btn-ghost"
            style={{
              borderRadius: 0,
              borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
              color: tab === t ? 'var(--accent)' : 'var(--text-muted)',
              fontWeight: tab === t ? 600 : 400,
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Projects' && <ProjectsTab onNew={() => setShowNew(true)} />}
      {tab === 'Templates' && <TemplatesTab />}

      <NewProjectModal
        open={showNew}
        onClose={() => setShowNew(false)}
        onCreated={id => { qc.invalidateQueries({ queryKey: ['projects'] }); navigate(`/pm/projects/${id}`) }}
      />
    </div>
  )
}
