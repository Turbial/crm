import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Edit2, Trash2, Phone, Mail, Globe, Building2,
  MapPin, Star, User, Calendar, Plus, MessageSquare, CheckSquare,
  FileText, Briefcase, TrendingUp, Activity, ChevronRight,
} from 'lucide-react'
import { get, post, patch, del } from '../../api'
import {
  Spinner, Badge, EmptyState, Modal, Avatar, TabBar,
  DataTable, Timeline, DetailRow, RelativeTime, MoneyDisplay, formatMoney,
  FormField, Toast, useToast, ConfirmDialog, ErrorMessage,
} from '../../components'

// ─── Constants ────────────────────────────────────────────────────────────────

const PIPELINE_STATUSES = ['new', 'contacted', 'qualified', 'appointment', 'proposal', 'negotiation', 'won']
const ALL_STATUSES = [...PIPELINE_STATUSES, 'lost']

const SOURCE_LABELS = {
  website: 'Website', referral: 'Referral', social: 'Social Media',
  email: 'Email Campaign', cold_call: 'Cold Call', event: 'Event', other: 'Other',
}

const TABS = [
  { key: 'overview',    label: 'Overview',    icon: User },
  { key: 'activities',  label: 'Activities',  icon: Activity },
  { key: 'notes',       label: 'Notes',       icon: FileText },
  { key: 'deals',       label: 'Deals',       icon: Briefcase },
  { key: 'quotes',      label: 'Quotes',      icon: TrendingUp },
  { key: 'timeline',    label: 'Timeline',    icon: Activity },
]

// ─── Status Pipeline Bar ──────────────────────────────────────────────────────

function StatusPipelineBar({ current, onChange, isUpdating }) {
  const currentIdx = PIPELINE_STATUSES.indexOf(current)
  const isLost = current === 'lost'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, flexWrap: 'wrap', rowGap: 8 }}>
      {PIPELINE_STATUSES.map((status, idx) => {
        const isPast   = !isLost && idx < currentIdx
        const isActive = !isLost && idx === currentIdx
        const isFuture = isLost || idx > currentIdx

        let bg, color, border, cursor
        if (isActive) {
          bg = 'var(--accent)'; color = '#fff'; border = 'var(--accent)'; cursor = 'default'
        } else if (isPast) {
          bg = 'var(--success-soft)'; color = 'var(--success)'; border = 'var(--success)'; cursor = 'pointer'
        } else {
          bg = 'transparent'; color = 'var(--text-muted)'; border = 'var(--border-subtle)'; cursor = 'pointer'
        }

        return (
          <div key={status} style={{ display: 'flex', alignItems: 'center' }}>
            <button
              disabled={isUpdating || isActive}
              onClick={() => !isActive && onChange(status)}
              style={{
                background: bg, color, border: `1px solid ${border}`,
                borderRadius: 20, padding: '4px 14px', fontSize: 12.5,
                fontWeight: isActive ? 600 : 500, cursor,
                transition: 'all .15s', whiteSpace: 'nowrap',
                opacity: isUpdating ? .6 : 1,
              }}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
            {idx < PIPELINE_STATUSES.length - 1 && (
              <div style={{ width: 24, height: 1, background: 'var(--border-subtle)', margin: '0 2px' }} />
            )}
          </div>
        )
      })}

      {/* Lost separate */}
      <div style={{ marginLeft: 8 }}>
        <button
          disabled={isUpdating}
          onClick={() => onChange('lost')}
          style={{
            background: isLost ? 'var(--danger)' : 'transparent',
            color: isLost ? '#fff' : 'var(--danger)',
            border: `1px solid var(--danger)`,
            borderRadius: 20, padding: '4px 14px', fontSize: 12.5,
            fontWeight: isLost ? 600 : 500, cursor: isLost ? 'default' : 'pointer',
            opacity: isUpdating ? .6 : 1, transition: 'all .15s',
          }}
        >
          Lost
        </button>
      </div>
    </div>
  )
}

// ─── Convert to Deal Modal ────────────────────────────────────────────────────

function ConvertToDealModal({ open, onClose, lead, onSuccess }) {
  const [form, setForm] = useState({
    title: lead?.name || '',
    value: '',
    expected_close_date: '',
    stage: 'qualified',
  })
  const [error, setError] = useState(null)

  const mutation = useMutation({
    mutationFn: body => post('/deals', body),
    onSuccess: data => {
      setError(null)
      onSuccess(data)
    },
    onError: err => setError(err?.message || 'Failed to create deal'),
  })

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim()) return setError('Deal name is required')
    mutation.mutate({
      title: form.title.trim(),
      value: form.value ? Number(form.value) : 0,
      expected_close_date: form.expected_close_date || null,
      stage: form.stage,
      lead_id: lead?.id,
    })
  }

  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Convert to Deal"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={mutation.isPending}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? 'Creating…' : 'Create Deal'}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <FormField label="Deal Name" required value={form.title} onChange={e => f('title', e.target.value)} placeholder="Deal name" />
        <FormField label="Value ($)" type="number" value={form.value} onChange={e => f('value', e.target.value)} placeholder="0" />
        <FormField label="Expected Close Date" type="date" value={form.expected_close_date} onChange={e => f('expected_close_date', e.target.value)} />
        <FormField label="Stage">
          <select className="form-input" value={form.stage} onChange={e => f('stage', e.target.value)}>
            {['lead', 'qualified', 'proposal', 'negotiation'].map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </FormField>
        {error && <ErrorMessage message={error} />}
      </form>
    </Modal>
  )
}

// ─── Create Task Modal ────────────────────────────────────────────────────────

function CreateTaskModal({ open, onClose, leadId, onSuccess }) {
  const [form, setForm] = useState({ title: '', priority: 'medium', due_at: '', description: '' })
  const [error, setError] = useState(null)

  const mutation = useMutation({
    mutationFn: body => post('/tasks', body),
    onSuccess: () => { setError(null); onSuccess() },
    onError: err => setError(err?.message || 'Failed to create task'),
  })

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim()) return setError('Title is required')
    mutation.mutate({
      title: form.title.trim(),
      priority: form.priority,
      due_at: form.due_at || null,
      description: form.description || null,
      lead_id: leadId,
      status: 'open',
    })
  }

  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create Task"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={mutation.isPending}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? 'Creating…' : 'Create Task'}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <FormField label="Title" required value={form.title} onChange={e => f('title', e.target.value)} placeholder="Task title" autoFocus />
        <FormField label="Priority">
          <select className="form-input" value={form.priority} onChange={e => f('priority', e.target.value)}>
            {['low', 'medium', 'high'].map(p => (
              <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Due Date" type="date" value={form.due_at} onChange={e => f('due_at', e.target.value)} />
        <FormField label="Description">
          <textarea
            className="form-input"
            value={form.description}
            onChange={e => f('description', e.target.value)}
            placeholder="Optional description…"
            rows={3}
          />
        </FormField>
        {error && <ErrorMessage message={error} />}
      </form>
    </Modal>
  )
}

// ─── Log Communication Modal ──────────────────────────────────────────────────

function LogCallModal({ open, onClose, leadId, onSuccess }) {
  const [form, setForm] = useState({ channel: 'call', direction: 'outbound', subject: '', content: '' })
  const [error, setError] = useState(null)

  const mutation = useMutation({
    mutationFn: body => post('/communications', body),
    onSuccess: () => { setError(null); onSuccess() },
    onError: err => setError(err?.message || 'Failed to log communication'),
  })

  function handleSubmit(e) {
    e.preventDefault()
    mutation.mutate({
      channel: form.channel,
      direction: form.direction,
      subject: form.subject || null,
      content: form.content || null,
      lead_id: leadId,
    })
  }

  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Log Communication"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={mutation.isPending}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? 'Logging…' : 'Log Communication'}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <FormField label="Channel">
          <select className="form-input" value={form.channel} onChange={e => f('channel', e.target.value)}>
            {['call', 'email', 'sms', 'chat'].map(c => (
              <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Direction">
          <select className="form-input" value={form.direction} onChange={e => f('direction', e.target.value)}>
            <option value="outbound">Outbound</option>
            <option value="inbound">Inbound</option>
          </select>
        </FormField>
        <FormField label="Subject" value={form.subject} onChange={e => f('subject', e.target.value)} placeholder="Optional subject" />
        <FormField label="Notes / Content">
          <textarea
            className="form-input"
            value={form.content}
            onChange={e => f('content', e.target.value)}
            placeholder="What was discussed…"
            rows={4}
          />
        </FormField>
        {error && <ErrorMessage message={error} />}
      </form>
    </Modal>
  )
}

// ─── Add Note Modal ───────────────────────────────────────────────────────────

function AddNoteModal({ open, onClose, leadId, onSuccess }) {
  const [content, setContent] = useState('')
  const [error, setError] = useState(null)

  const mutation = useMutation({
    mutationFn: body => post('/notes', body),
    onSuccess: () => { setError(null); setContent(''); onSuccess() },
    onError: err => setError(err?.message || 'Failed to add note'),
  })

  function handleSubmit(e) {
    e.preventDefault()
    if (!content.trim()) return setError('Note content is required')
    mutation.mutate({ content: content.trim(), lead_id: leadId })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Note"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={mutation.isPending}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : 'Add Note'}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <FormField label="Note" required>
          <textarea
            className="form-input"
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Write a note…"
            rows={5}
            autoFocus
          />
        </FormField>
        {error && <ErrorMessage message={error} />}
      </form>
    </Modal>
  )
}

// ─── Edit Lead Modal ──────────────────────────────────────────────────────────

function EditLeadModal({ open, onClose, lead, onSuccess }) {
  const [form, setForm] = useState({
    name: lead?.name || '',
    email: lead?.email || '',
    phone: lead?.phone || '',
    company: lead?.company || '',
    source: lead?.source || '',
    score: lead?.score ?? '',
    city: lead?.city || '',
    state: lead?.state || '',
    website: lead?.website || '',
    status: lead?.status || 'new',
    assigned_to: lead?.assigned_to || '',
  })
  const [error, setError] = useState(null)

  const mutation = useMutation({
    mutationFn: body => patch(`/leads/${lead?.id}`, body),
    onSuccess: (data) => { setError(null); onSuccess(data) },
    onError: err => setError(err?.message || 'Failed to update lead'),
  })

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) return setError('Name is required')
    mutation.mutate({
      ...form,
      score: form.score !== '' ? Number(form.score) : null,
    })
  }

  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit Lead"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={mutation.isPending}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : 'Save Changes'}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="Name" required value={form.name} onChange={e => f('name', e.target.value)} />
          <FormField label="Email" type="email" value={form.email} onChange={e => f('email', e.target.value)} />
          <FormField label="Phone" value={form.phone} onChange={e => f('phone', e.target.value)} />
          <FormField label="Company" value={form.company} onChange={e => f('company', e.target.value)} />
          <FormField label="City" value={form.city} onChange={e => f('city', e.target.value)} />
          <FormField label="State" value={form.state} onChange={e => f('state', e.target.value)} />
        </div>
        <FormField label="Website" value={form.website} onChange={e => f('website', e.target.value)} placeholder="https://…" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="Source">
            <select className="form-input" value={form.source} onChange={e => f('source', e.target.value)}>
              <option value="">— Select —</option>
              {Object.entries(SOURCE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </FormField>
          <FormField label="Status">
            <select className="form-input" value={form.status} onChange={e => f('status', e.target.value)}>
              {ALL_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </FormField>
          <FormField label="Score (0-100)" type="number" value={form.score} onChange={e => f('score', e.target.value)} placeholder="0" />
          <FormField label="Assigned To" value={form.assigned_to} onChange={e => f('assigned_to', e.target.value)} placeholder="Name or ID" />
        </div>
        {error && <ErrorMessage message={error} />}
      </form>
    </Modal>
  )
}

// ─── Tab: Overview ────────────────────────────────────────────────────────────

function OverviewTab({ lead, onEdit }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Lead Information</h3>
        <button className="btn btn-secondary btn-sm" onClick={onEdit} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Edit2 size={13} /> Edit
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <DetailRow label="Full Name" value={lead.name} />
        <DetailRow label="Company">
          {lead.company ? (
            <span style={{ fontSize: 13.5, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Building2 size={13} color="var(--text-muted)" /> {lead.company}
            </span>
          ) : <span style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>—</span>}
        </DetailRow>
        <DetailRow label="Email">
          {lead.email ? (
            <a href={`mailto:${lead.email}`} style={{ color: 'var(--accent)', fontSize: 13.5, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Mail size={13} /> {lead.email}
            </a>
          ) : <span style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>—</span>}
        </DetailRow>
        <DetailRow label="Phone">
          {lead.phone ? (
            <a href={`tel:${lead.phone}`} style={{ color: 'var(--accent)', fontSize: 13.5, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Phone size={13} /> {lead.phone}
            </a>
          ) : <span style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>—</span>}
        </DetailRow>
        <DetailRow label="Source" value={SOURCE_LABELS[lead.source] || lead.source || '—'} />
        <DetailRow label="Status">
          <Badge label={lead.status} />
        </DetailRow>
        <DetailRow label="Location">
          {(lead.city || lead.state) ? (
            <span style={{ fontSize: 13.5, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <MapPin size={13} color="var(--text-muted)" />
              {[lead.city, lead.state].filter(Boolean).join(', ')}
            </span>
          ) : <span style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>—</span>}
        </DetailRow>
        <DetailRow label="Website">
          {lead.website ? (
            <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
              target="_blank" rel="noopener noreferrer"
              style={{ color: 'var(--accent)', fontSize: 13.5, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Globe size={13} /> {lead.website}
            </a>
          ) : <span style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>—</span>}
        </DetailRow>
        <DetailRow label="Lead Score">
          {lead.score != null ? (
            <span style={{ fontSize: 13.5, fontWeight: 600, color: lead.score >= 70 ? 'var(--success)' : lead.score >= 40 ? 'var(--warning)' : 'var(--danger)' }}>
              {lead.score} / 100
            </span>
          ) : <span style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>—</span>}
        </DetailRow>
        <DetailRow label="Assigned To">
          {lead.assigned_to ? (
            <span style={{ fontSize: 13.5, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Avatar name={lead.assigned_to} size={20} />
              {lead.assigned_to}
            </span>
          ) : <span style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>Unassigned</span>}
        </DetailRow>
        <DetailRow label="Created">
          <RelativeTime date={lead.created_at} />
        </DetailRow>
        <DetailRow label="Last Updated">
          <RelativeTime date={lead.updated_at} />
        </DetailRow>
      </div>
    </div>
  )
}

// ─── Tab: Activities ──────────────────────────────────────────────────────────

const CHANNEL_COLORS = { call: 'blue', email: 'purple', sms: 'yellow', chat: 'green' }

function ActivitiesTab({ leadId, onLogCall, onCreateTask }) {
  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks', { lead_id: leadId }],
    queryFn: () => get(`/tasks?lead_id=${leadId}&limit=50`),
    retry: false,
  })

  const { data: comms = [], isLoading: commsLoading } = useQuery({
    queryKey: ['communications', { lead_id: leadId }],
    queryFn: () => get(`/communications?lead_id=${leadId}`),
    retry: false,
  })

  const [selected, setSelected] = useState(null)

  const items = useMemo(() => {
    const taskItems = (Array.isArray(tasks) ? tasks : tasks?.data || []).map(t => ({
      ...t, _type: 'task', _date: t.due_at || t.created_at,
    }))
    const commItems = (Array.isArray(comms) ? comms : comms?.data || []).map(c => ({
      ...c, _type: 'comm', _date: c.occurred_at || c.created_at,
    }))
    return [...taskItems, ...commItems].sort((a, b) => new Date(b._date) - new Date(a._date))
  }, [tasks, comms])

  if (tasksLoading || commsLoading) return <Spinner />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button className="btn btn-secondary btn-sm" onClick={onCreateTask} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <CheckSquare size={13} /> Create Task
        </button>
        <button className="btn btn-secondary btn-sm" onClick={onLogCall} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Phone size={13} /> Log Communication
        </button>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={Activity} title="No activities yet" description="Log a call or create a task to get started." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((item, i) => (
            <div
              key={`${item._type}-${item.id || i}`}
              className="card"
              style={{ cursor: 'pointer', padding: '12px 16px' }}
              onClick={() => setSelected(selected?.id === item.id && selected?._type === item._type ? null : item)}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                  background: item._type === 'task' ? 'var(--accent-soft)' : 'var(--surface-2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {item._type === 'task'
                    ? <CheckSquare size={15} color="var(--accent)" />
                    : <MessageSquare size={15} color="var(--text-muted)" />
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: 13.5 }}>
                      {item._type === 'task' ? item.title : (item.subject || `${item.channel} ${item.direction}`)}
                    </span>
                    {item._type === 'task' && item.priority && <Badge label={item.priority} />}
                    {item._type === 'task' && item.status && <Badge label={item.status} />}
                    {item._type === 'comm' && item.channel && <Badge label={item.channel} color={CHANNEL_COLORS[item.channel] || 'gray'} />}
                    {item._type === 'comm' && item.direction && <Badge label={item.direction} color="gray" />}
                  </div>
                  {item._type === 'comm' && item.content && (
                    <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.content}
                    </p>
                  )}
                  {item._type === 'task' && item.description && (
                    <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.description}
                    </p>
                  )}
                </div>
                <div style={{ flexShrink: 0, textAlign: 'right' }}>
                  <RelativeTime date={item._date} />
                </div>
              </div>
              {selected?.id === item.id && selected?._type === item._type && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-subtle)', fontSize: 13 }}>
                  {item._type === 'comm' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {item.subject && <div><strong>Subject:</strong> {item.subject}</div>}
                      {item.content && <div><strong>Notes:</strong> {item.content}</div>}
                    </div>
                  )}
                  {item._type === 'task' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {item.description && <div><strong>Description:</strong> {item.description}</div>}
                      {item.due_at && <div><strong>Due:</strong> {new Date(item.due_at).toLocaleDateString()}</div>}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Tab: Notes ───────────────────────────────────────────────────────────────

function NotesTab({ leadId, onAddNote }) {
  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['notes', { lead_id: leadId }],
    queryFn: () => get(`/notes?lead_id=${leadId}`),
    retry: false,
  })

  const noteList = Array.isArray(notes) ? notes : notes?.data || []

  if (isLoading) return <Spinner />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-primary btn-sm" onClick={onAddNote} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Plus size={13} /> Add Note
        </button>
      </div>
      {noteList.length === 0 ? (
        <EmptyState icon={FileText} title="No notes yet" description="Add a note to capture important information about this lead." />
      ) : (
        noteList.map((note, i) => (
          <div key={note.id || i} className="card" style={{ padding: '14px 16px' }}>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{note.content}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
              {note.author_name && (
                <>
                  <Avatar name={note.author_name} size={20} />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{note.author_name}</span>
                  <span style={{ fontSize: 12, color: 'var(--border-subtle)' }}>·</span>
                </>
              )}
              <RelativeTime date={note.created_at} />
            </div>
          </div>
        ))
      )}
    </div>
  )
}

// ─── Tab: Deals ───────────────────────────────────────────────────────────────

function DealsTab({ leadId, onConvert, lead }) {
  const navigate = useNavigate()
  const { data: dealsRaw = [], isLoading } = useQuery({
    queryKey: ['deals', { lead_id: leadId }],
    queryFn: async () => {
      try {
        return await get(`/deals?lead_id=${leadId}`)
      } catch {
        const all = await get('/deals')
        const arr = Array.isArray(all) ? all : all?.data || []
        return arr.filter(d => d.lead_id === leadId || String(d.lead_id) === String(leadId))
      }
    },
    retry: false,
  })

  const deals = Array.isArray(dealsRaw) ? dealsRaw : dealsRaw?.data || []
  const canConvert = !['won', 'lost'].includes(lead?.status)

  const columns = [
    { key: 'title', label: 'Deal Name', render: row => <span style={{ fontWeight: 600 }}>{row.title}</span> },
    { key: 'stage', label: 'Stage', render: row => <Badge label={row.stage} /> },
    { key: 'value', label: 'Value', render: row => <MoneyDisplay amount={row.value} /> },
    { key: 'expected_close_date', label: 'Close Date', render: row => row.expected_close_date ? new Date(row.expected_close_date).toLocaleDateString() : '—' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {canConvert && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary btn-sm" onClick={onConvert} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <TrendingUp size={13} /> Convert to Deal
          </button>
        </div>
      )}
      <DataTable
        columns={columns}
        data={deals}
        isLoading={isLoading}
        emptyIcon={Briefcase}
        emptyTitle="No deals yet"
        emptyDescription={canConvert ? 'Convert this lead to create a deal.' : 'No deals linked to this lead.'}
        emptyAction={canConvert && (
          <button className="btn btn-primary btn-sm" onClick={onConvert} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <TrendingUp size={13} /> Convert to Deal
          </button>
        )}
        onRowClick={row => navigate(`/crm/deals/${row.id}`)}
      />
    </div>
  )
}

// ─── Tab: Quotes ──────────────────────────────────────────────────────────────

function QuotesTab({ leadId }) {
  const navigate = useNavigate()
  const { data: quotesRaw = [], isLoading } = useQuery({
    queryKey: ['quotes', { lead_id: leadId }],
    queryFn: () => get(`/quotes?lead_id=${leadId}`),
    retry: false,
  })

  const quotes = Array.isArray(quotesRaw) ? quotesRaw : quotesRaw?.data || []

  const columns = [
    { key: 'title', label: 'Title', render: row => <span style={{ fontWeight: 600 }}>{row.title || row.name || '—'}</span> },
    { key: 'status', label: 'Status', render: row => <Badge label={row.status} /> },
    { key: 'total', label: 'Total', render: row => <MoneyDisplay amount={row.total ?? row.amount} /> },
    { key: 'created_at', label: 'Created', render: row => <RelativeTime date={row.created_at} /> },
  ]

  return (
    <DataTable
      columns={columns}
      data={quotes}
      isLoading={isLoading}
      emptyIcon={TrendingUp}
      emptyTitle="No quotes yet"
      emptyDescription="No quotes linked to this lead."
      onRowClick={row => navigate(`/sales/quotes/${row.id}`)}
    />
  )
}

// ─── Tab: Timeline ────────────────────────────────────────────────────────────

function TimelineTab({ leadId }) {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['timeline', 'lead', leadId],
    queryFn: () => get(`/timeline/lead/${leadId}`),
    retry: false,
  })

  if (isLoading) return <Spinner />
  const evList = Array.isArray(events) ? events : events?.data || []
  return <Timeline events={evList} />
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LeadDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [toast, showToast] = useToast()

  const [tab, setTab] = useState('overview')
  const [modal, setModal] = useState(null) // 'convert' | 'task' | 'call' | 'note' | 'edit' | 'delete'

  const { data: lead, isLoading, isError } = useQuery({
    queryKey: ['lead', id],
    queryFn: () => get(`/leads/${id}`),
  })

  const updateLead = useMutation({
    mutationFn: body => patch(`/leads/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead', id] })
      showToast('Lead updated', 'success')
    },
    onError: err => showToast(err?.message || 'Update failed', 'error'),
  })

  const deleteLead = useMutation({
    mutationFn: () => del(`/leads/${id}`),
    onSuccess: () => navigate('/crm/leads'),
    onError: err => showToast(err?.message || 'Delete failed', 'error'),
  })

  function handleStatusChange(newStatus) {
    updateLead.mutate({ status: newStatus })
  }

  function handleConvertSuccess(deal) {
    setModal(null)
    showToast('Deal created!', 'success')
    qc.invalidateQueries({ queryKey: ['deals', { lead_id: id }] })
    if (deal?.id) navigate(`/crm/deals/${deal.id}`)
  }

  function handleTaskSuccess() {
    setModal(null)
    showToast('Task created!', 'success')
    qc.invalidateQueries({ queryKey: ['tasks', { lead_id: id }] })
  }

  function handleCallSuccess() {
    setModal(null)
    showToast('Communication logged!', 'success')
    qc.invalidateQueries({ queryKey: ['communications', { lead_id: id }] })
  }

  function handleNoteSuccess() {
    setModal(null)
    showToast('Note added!', 'success')
    qc.invalidateQueries({ queryKey: ['notes', { lead_id: id }] })
  }

  function handleEditSuccess() {
    setModal(null)
    showToast('Lead updated!', 'success')
    qc.invalidateQueries({ queryKey: ['lead', id] })
  }

  if (isLoading) return <div style={{ padding: 40 }}><Spinner /></div>
  if (isError || !lead) {
    return (
      <div style={{ padding: 40 }}>
        <ErrorMessage message="Lead not found or failed to load." />
      </div>
    )
  }

  const canConvert = !['won', 'lost'].includes(lead.status)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '0 0 40px' }}>

      {/* Toast */}
      {toast.message && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 1000, minWidth: 280 }}>
          <Toast {...toast} />
        </div>
      )}

      {/* Header Row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', rowGap: 8 }}>
        <button
          className="btn btn-ghost btn-icon"
          onClick={() => navigate(-1)}
          title="Go back"
        >
          <ArrowLeft size={16} />
        </button>

        <Avatar name={lead.name} size={38} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {lead.name}
          </h1>
          <Badge label={lead.status} />
          {lead.score != null && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              background: 'var(--surface-2)', border: '1px solid var(--border-subtle)',
              borderRadius: 20, padding: '2px 10px', fontSize: 12.5, fontWeight: 600,
              color: lead.score >= 70 ? 'var(--success)' : lead.score >= 40 ? 'var(--warning)' : 'var(--danger)',
            }}>
              <Star size={12} /> Score: {lead.score}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {canConvert && (
            <button className="btn btn-primary btn-sm" onClick={() => setModal('convert')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <TrendingUp size={13} /> Convert to Deal
            </button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={() => setModal('task')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <CheckSquare size={13} /> Create Task
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setModal('call')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Phone size={13} /> Log Call
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setModal('edit')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Edit2 size={13} /> Edit
          </button>
          <button className="btn btn-danger btn-sm" onClick={() => setModal('delete')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Trash2 size={13} /> Delete
          </button>
        </div>
      </div>

      {/* Status Pipeline Bar */}
      <div className="card" style={{ padding: '14px 20px' }}>
        <StatusPipelineBar
          current={lead.status}
          onChange={handleStatusChange}
          isUpdating={updateLead.isPending}
        />
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

        {/* Left: Contact Info + Quick Actions */}
        <div style={{ width: 350, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Contact Info Card */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)' }}>
              Contact Info
            </h3>

            {lead.email && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Mail size={15} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                <a href={`mailto:${lead.email}`} style={{ fontSize: 13.5, color: 'var(--accent)', fontWeight: 500, wordBreak: 'break-all' }}>
                  {lead.email}
                </a>
              </div>
            )}
            {lead.phone && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Phone size={15} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                <a href={`tel:${lead.phone}`} style={{ fontSize: 13.5, color: 'var(--accent)', fontWeight: 500 }}>
                  {lead.phone}
                </a>
              </div>
            )}
            {lead.company && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Building2 size={15} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 13.5, fontWeight: 500 }}>{lead.company}</span>
              </div>
            )}
            {lead.source && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <ChevronRight size={15} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Source:</span>
                <span style={{ fontSize: 13.5, fontWeight: 500 }}>{SOURCE_LABELS[lead.source] || lead.source}</span>
              </div>
            )}
            {(lead.city || lead.state) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <MapPin size={15} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 13.5, fontWeight: 500 }}>{[lead.city, lead.state].filter(Boolean).join(', ')}</span>
              </div>
            )}
            {lead.website && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Globe size={15} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                <a
                  href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 13.5, color: 'var(--accent)', fontWeight: 500, wordBreak: 'break-all' }}
                >
                  {lead.website}
                </a>
              </div>
            )}

            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--text-muted)' }}>Score</span>
                <span style={{ fontWeight: 600, color: lead.score >= 70 ? 'var(--success)' : lead.score >= 40 ? 'var(--warning)' : 'var(--text)' }}>
                  {lead.score ?? '—'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--text-muted)' }}>Assigned to</span>
                <span style={{ fontWeight: 500 }}>{lead.assigned_to || 'Unassigned'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--text-muted)' }}>Created</span>
                <RelativeTime date={lead.created_at} />
              </div>
            </div>
          </div>

          {/* Quick Actions Card */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)' }}>
              Quick Actions
            </h3>
            {canConvert && (
              <button
                className="btn btn-primary"
                onClick={() => setModal('convert')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, justifyContent: 'flex-start' }}
              >
                <TrendingUp size={15} /> Convert to Deal
              </button>
            )}
            <button
              className="btn btn-secondary"
              onClick={() => { setModal('task'); setTab('activities') }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, justifyContent: 'flex-start' }}
            >
              <CheckSquare size={15} /> Create Task
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => { setModal('call'); setTab('activities') }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, justifyContent: 'flex-start' }}
            >
              <Phone size={15} /> Log Call
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => { setModal('note'); setTab('notes') }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, justifyContent: 'flex-start' }}
            >
              <FileText size={15} /> Add Note
            </button>
          </div>
        </div>

        {/* Right: Tabs */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="card" style={{ padding: 20 }}>
            <TabBar
              tabs={TABS}
              active={tab}
              onChange={setTab}
              variant="underline"
            />

            {tab === 'overview' && (
              <OverviewTab lead={lead} onEdit={() => setModal('edit')} />
            )}
            {tab === 'activities' && (
              <ActivitiesTab
                leadId={id}
                onLogCall={() => setModal('call')}
                onCreateTask={() => setModal('task')}
              />
            )}
            {tab === 'notes' && (
              <NotesTab leadId={id} onAddNote={() => setModal('note')} />
            )}
            {tab === 'deals' && (
              <DealsTab leadId={id} lead={lead} onConvert={() => setModal('convert')} />
            )}
            {tab === 'quotes' && (
              <QuotesTab leadId={id} />
            )}
            {tab === 'timeline' && (
              <TimelineTab leadId={id} />
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {modal === 'convert' && (
        <ConvertToDealModal
          open
          onClose={() => setModal(null)}
          lead={lead}
          onSuccess={handleConvertSuccess}
        />
      )}
      {modal === 'task' && (
        <CreateTaskModal
          open
          onClose={() => setModal(null)}
          leadId={id}
          onSuccess={handleTaskSuccess}
        />
      )}
      {modal === 'call' && (
        <LogCallModal
          open
          onClose={() => setModal(null)}
          leadId={id}
          onSuccess={handleCallSuccess}
        />
      )}
      {modal === 'note' && (
        <AddNoteModal
          open
          onClose={() => setModal(null)}
          leadId={id}
          onSuccess={handleNoteSuccess}
        />
      )}
      {modal === 'edit' && (
        <EditLeadModal
          open
          onClose={() => setModal(null)}
          lead={lead}
          onSuccess={handleEditSuccess}
        />
      )}
      <ConfirmDialog
        open={modal === 'delete'}
        onClose={() => setModal(null)}
        onConfirm={() => deleteLead.mutate()}
        title="Delete Lead"
        message={`Are you sure you want to delete "${lead.name}"? This action cannot be undone.`}
        confirmLabel="Delete Lead"
        variant="danger"
        isLoading={deleteLead.isPending}
      />
    </div>
  )
}
