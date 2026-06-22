import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { get, post, patch, del } from '../../api'
import {
  Spinner, Badge, Modal, Timeline, TabBar, DetailRow,
  MoneyDisplay, formatMoney, Toast, useToast, ConfirmDialog, ErrorMessage,
} from '../../components'

const PIPELINE_STAGES = ['lead', 'qualified', 'proposal', 'negotiation', 'won']

function daysUntil(dateStr) {
  if (!dateStr) return null
  const diff = Math.round((new Date(dateStr) - Date.now()) / 86400000)
  return diff
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

// ── Stage pipeline bar ────────────────────────────────────────────────────────
function StagePipeline({ current, onMove, isPending }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
      {PIPELINE_STAGES.map((s, i) => {
        const idx = PIPELINE_STAGES.indexOf(current)
        const isPast = i < idx
        const isActive = s === current
        let bg = 'transparent'
        let color = 'var(--text-muted)'
        let border = '1px solid var(--border-subtle)'
        if (isActive) { bg = 'var(--accent)'; color = '#fff'; border = '1px solid var(--accent)' }
        else if (isPast) { bg = 'var(--success-soft)'; color = 'var(--success)'; border = '1px solid var(--success)' }
        return (
          <button
            key={s}
            disabled={isPending || isActive}
            onClick={() => onMove(s)}
            style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 20, background: bg, color, border, cursor: isActive ? 'default' : 'pointer', textTransform: 'capitalize', opacity: isPending ? 0.6 : 1 }}
          >
            {s}
          </button>
        )
      })}
      {current === 'lost' && (
        <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: 'var(--danger-soft)', color: 'var(--danger)', border: '1px solid var(--danger)' }}>
          lost
        </span>
      )}
    </div>
  )
}

// ── Won modal ─────────────────────────────────────────────────────────────────
function WonModal({ open, onClose, deal, onConfirm, isPending }) {
  const today = new Date().toISOString().slice(0, 10)
  const [value, setValue] = useState(deal?.value ?? '')
  const [closeDate, setCloseDate] = useState(deal?.expected_close_date?.slice(0, 10) || today)
  const [note, setNote] = useState('')
  return (
    <Modal open={open} onClose={onClose} title="Mark Deal as Won"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={isPending}>Cancel</button>
          <button className="btn btn-success" onClick={() => onConfirm({ value: parseFloat(value) || 0, closed_at: closeDate, note })} disabled={isPending}>
            {isPending ? 'Saving…' : 'Confirm Won'}
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label className="form-label">Final Value</label>
          <input className="form-input" type="number" min="0" value={value} onChange={e => setValue(e.target.value)} />
        </div>
        <div>
          <label className="form-label">Close Date</label>
          <input className="form-input" type="date" value={closeDate} onChange={e => setCloseDate(e.target.value)} />
        </div>
        <div>
          <label className="form-label">Note / Reason (optional)</label>
          <textarea className="form-input" rows={3} value={note} onChange={e => setNote(e.target.value)} style={{ resize: 'vertical' }} />
        </div>
      </div>
    </Modal>
  )
}

// ── Lost modal ────────────────────────────────────────────────────────────────
function LostModal({ open, onClose, onConfirm, isPending }) {
  const [reason, setReason] = useState('')
  const [competitor, setCompetitor] = useState('')
  return (
    <Modal open={open} onClose={onClose} title="Mark Deal as Lost"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={isPending}>Cancel</button>
          <button className="btn btn-danger" onClick={() => onConfirm({ reason, competitor })} disabled={isPending}>
            {isPending ? 'Saving…' : 'Confirm Lost'}
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label className="form-label">Lost Reason</label>
          <textarea className="form-input" rows={3} value={reason} onChange={e => setReason(e.target.value)} style={{ resize: 'vertical' }} />
        </div>
        <div>
          <label className="form-label">Competitor (optional)</label>
          <input className="form-input" value={competitor} onChange={e => setCompetitor(e.target.value)} />
        </div>
      </div>
    </Modal>
  )
}

// ── Task modal ────────────────────────────────────────────────────────────────
function TaskModal({ open, onClose, onConfirm, isPending }) {
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState('medium')
  const [dueAt, setDueAt] = useState('')
  function submit() { if (title.trim()) onConfirm({ title, priority, due_at: dueAt || undefined }); setTitle(''); setPriority('medium'); setDueAt('') }
  return (
    <Modal open={open} onClose={onClose} title="Create Task"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={isPending}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={isPending || !title.trim()}>
            {isPending ? 'Saving…' : 'Create Task'}
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label className="form-label">Title *</label>
          <input className="form-input" value={title} onChange={e => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="form-label">Priority</label>
          <select className="form-input" value={priority} onChange={e => setPriority(e.target.value)}>
            {['low', 'medium', 'high', 'critical'].map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">Due Date</label>
          <input className="form-input" type="date" value={dueAt} onChange={e => setDueAt(e.target.value)} />
        </div>
      </div>
    </Modal>
  )
}

// ── Note modal ────────────────────────────────────────────────────────────────
function NoteModal({ open, onClose, onConfirm, isPending }) {
  const [content, setContent] = useState('')
  function submit() { if (content.trim()) onConfirm(content); setContent('') }
  return (
    <Modal open={open} onClose={onClose} title="Add Note"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={isPending}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={isPending || !content.trim()}>
            {isPending ? 'Saving…' : 'Add Note'}
          </button>
        </>
      }
    >
      <textarea className="form-input" rows={5} value={content} onChange={e => setContent(e.target.value)} placeholder="Write your note…" style={{ resize: 'vertical', width: '100%' }} />
    </Modal>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DealDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [tab, setTab] = useState('overview')
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [wonOpen, setWonOpen] = useState(false)
  const [lostOpen, setLostOpen] = useState(false)
  const [taskOpen, setTaskOpen] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [wonBanner, setWonBanner] = useState(false)
  const [lostBanner, setLostBanner] = useState(false)
  const [toast, showToast] = useToast()

  const { data: deal, isLoading, error } = useQuery({ queryKey: ['deal', id], queryFn: () => get(`/deals/${id}`) })
  const { data: timeline = [] } = useQuery({ queryKey: ['timeline', 'deal', id], queryFn: () => get(`/timeline/deal/${id}`), enabled: !!deal, retry: false })
  const { data: tasks = [] } = useQuery({ queryKey: ['tasks', deal?.lead_id], queryFn: () => get(`/tasks?lead_id=${deal.lead_id}`), enabled: !!deal?.lead_id, retry: false })
  const { data: notes = [] } = useQuery({ queryKey: ['notes', deal?.lead_id], queryFn: () => get(`/notes?lead_id=${deal.lead_id}`), enabled: !!deal?.lead_id, retry: false })
  const { data: comms = [] } = useQuery({ queryKey: ['comms', deal?.lead_id], queryFn: () => get(`/communications?lead_id=${deal.lead_id}`), enabled: !!deal?.lead_id, retry: false })
  const { data: quotes = [] } = useQuery({ queryKey: ['quotes', deal?.lead_id], queryFn: () => get(`/quotes?lead_id=${deal.lead_id}`), enabled: !!deal?.lead_id, retry: false })
  const { data: linkedLead } = useQuery({ queryKey: ['lead', deal?.lead_id], queryFn: () => get(`/leads/${deal.lead_id}`), enabled: !!deal?.lead_id, retry: false })
  const { data: linkedContact } = useQuery({ queryKey: ['contact', deal?.contact_id], queryFn: () => get(`/contacts/${deal.contact_id}`), enabled: !!deal?.contact_id, retry: false })
  const { data: linkedCompany } = useQuery({ queryKey: ['company', deal?.company_id], queryFn: () => get(`/companies/${deal.company_id}`), enabled: !!deal?.company_id, retry: false })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['deal', id] })

  const updateDeal = useMutation({ mutationFn: body => patch(`/deals/${id}`, body), onSuccess: () => { invalidate(); setEditing(false); showToast('Deal updated', 'success') } })
  const deleteDeal = useMutation({ mutationFn: () => del(`/deals/${id}`), onSuccess: () => navigate('/crm/deals') })
  const moveStage = useMutation({ mutationFn: stage => patch(`/deals/${id}`, { stage }), onSuccess: invalidate })
  const markWon = useMutation({
    mutationFn: ({ value, closed_at }) => patch(`/deals/${id}`, { stage: 'won', value, closed_at }),
    onSuccess: () => { invalidate(); setWonOpen(false); setWonBanner(true) },
  })
  const markLost = useMutation({
    mutationFn: ({ reason }) => patch(`/deals/${id}`, { stage: 'lost', lost_reason: reason }),
    onSuccess: () => { invalidate(); setLostOpen(false); setLostBanner(true) },
  })
  const createTask = useMutation({
    mutationFn: body => post('/tasks', { ...body, lead_id: deal.lead_id }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks', deal.lead_id] }); setTaskOpen(false); showToast('Task created', 'success') },
  })
  const createNote = useMutation({
    mutationFn: content => post('/notes', { content, lead_id: deal.lead_id }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notes', deal.lead_id] }); setNoteOpen(false); showToast('Note added', 'success') },
  })
  const createQuote = useMutation({
    mutationFn: () => post('/quotes', { title: `${deal.title || deal.name} Quote`, lead_id: deal.lead_id, status: 'draft' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['quotes', deal.lead_id] }); showToast('Quote created', 'success') },
  })

  if (isLoading) return <div style={{ padding: 40 }}><Spinner /></div>
  if (error || !deal) return <ErrorMessage message={error?.message || 'Deal not found'} />

  function startEdit() {
    setForm({ title: deal.title || deal.name || '', value: deal.value ?? '', currency: deal.currency || 'USD', stage: deal.stage || 'lead', probability: deal.probability ?? '', expected_close_date: deal.expected_close_date?.slice(0, 10) || '', notes: deal.notes || '' })
    setEditing(true)
  }

  const days = daysUntil(deal.expected_close_date)
  const dealName = deal.title || deal.name || 'Untitled Deal'

  const TABS = [
    { key: 'overview', label: 'Overview' },
    { key: 'activity', label: 'Activity' },
    { key: 'contacts', label: 'Contacts' },
    { key: 'quotes', label: 'Quotes' },
    { key: 'notes', label: 'Notes' },
    { key: 'timeline', label: 'Timeline' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, minHeight: 0 }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <button className="btn btn-ghost btn-icon" onClick={() => navigate('/crm/deals')}><ArrowLeft size={16} /></button>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, flex: 1 }}>{dealName}</h1>
        <StagePipeline current={deal.stage} onMove={s => moveStage.mutate(s)} isPending={moveStage.isPending} />
        <button className="btn btn-danger btn-sm" onClick={() => setLostOpen(true)} disabled={deal.stage === 'lost'}>Mark Lost</button>
      </div>

      {/* Won/Lost banners */}
      {wonBanner && (
        <div style={{ background: 'var(--success-soft)', border: '1px solid var(--success)', borderRadius: 10, padding: '14px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, color: 'var(--success)', fontSize: 15 }}>🎉 Deal Won!</span>
          <Link to="/pm/projects" className="btn btn-success btn-sm">Create Project</Link>
          <Link to="/billing" className="btn btn-secondary btn-sm">Generate Invoice</Link>
          <Link to="/crm/deals" className="btn btn-ghost btn-sm">Back to Deals</Link>
          <button className="btn btn-ghost btn-sm" onClick={() => setWonBanner(false)} style={{ marginLeft: 'auto' }}>Dismiss</button>
        </div>
      )}
      {lostBanner && (
        <div style={{ background: 'var(--border-subtle)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: 14 }}>Deal closed as lost.</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setLostBanner(false)} style={{ marginLeft: 'auto' }}>Dismiss</button>
        </div>
      )}

      <Toast {...toast} />

      {/* Main layout: sidebar + content */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

        {/* Sidebar */}
        <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 600, marginBottom: 4 }}>Deal Value</div>
              <MoneyDisplay amount={deal.value} currency={deal.currency || 'USD'} style={{ fontSize: 28, fontWeight: 800 }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <DetailRow label="Probability">
                <Badge label={`${deal.probability ?? 0}%`} color="blue" />
              </DetailRow>
              <DetailRow label="Stage">
                <Badge label={deal.stage || 'lead'} />
              </DetailRow>
              <DetailRow label="Close Date" value={fmtDate(deal.expected_close_date)} />
              <DetailRow label="Days to Close">
                {days == null ? <span>—</span> : (
                  <span style={{ fontWeight: 600, color: days < 0 ? 'var(--danger)' : days <= 7 ? 'var(--warning)' : 'var(--text)' }}>
                    {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d`}
                  </span>
                )}
              </DetailRow>
              <DetailRow label="Created" value={fmtDate(deal.created_at)} />
              {deal.closed_at && <DetailRow label="Closed" value={fmtDate(deal.closed_at)} />}
            </div>
          </div>

          {/* Linked entities */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>Linked Entities</div>
            {linkedLead && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Lead</span>
                <Link to={`/crm/leads/${deal.lead_id}`} style={{ color: 'var(--accent)', fontWeight: 500 }}>{linkedLead.name}</Link>
              </div>
            )}
            {linkedCompany && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Company</span>
                <Link to={`/crm/companies/${deal.company_id}`} style={{ color: 'var(--accent)', fontWeight: 500 }}>{linkedCompany.name}</Link>
              </div>
            )}
            {linkedContact && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, padding: '6px 0' }}>
                <span style={{ color: 'var(--text-muted)' }}>Contact</span>
                <Link to={`/crm/contacts/${deal.contact_id}`} style={{ color: 'var(--accent)', fontWeight: 500 }}>{linkedContact.name}</Link>
              </div>
            )}
            {!linkedLead && !linkedCompany && !linkedContact && <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>No linked entities.</p>}
          </div>

          {/* Actions */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>Actions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button className="btn btn-success btn-sm" onClick={() => setWonOpen(true)} disabled={deal.stage === 'won'}>Mark Won</button>
              <button className="btn btn-secondary btn-sm" onClick={() => createQuote.mutate()} disabled={createQuote.isPending}>New Quote</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setTaskOpen(true)}>Create Task</button>
              <button className="btn btn-danger btn-sm" style={{ marginTop: 8 }} onClick={() => setDeleteOpen(true)}>Delete Deal</button>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <TabBar tabs={TABS} active={tab} onChange={setTab} variant="underline" />

          {tab === 'overview' && (
            <div className="card" style={{ padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Deal Details</h3>
                {!editing && <button className="btn btn-secondary btn-sm" onClick={startEdit}>Edit</button>}
              </div>
              {editing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {[['Deal Name', 'title', 'text'], ['Value', 'value', 'number'], ['Probability (%)', 'probability', 'number'], ['Close Date', 'expected_close_date', 'date']].map(([label, key, type]) => (
                    <div key={key}>
                      <label className="form-label">{label}</label>
                      <input className="form-input" type={type} value={form[key] ?? ''} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
                    </div>
                  ))}
                  <div>
                    <label className="form-label">Stage</label>
                    <select className="form-input" value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value }))}>
                      {['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Currency</label>
                    <select className="form-input" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                      {['USD', 'EUR', 'GBP', 'CAD', 'AUD'].map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Notes</label>
                    <textarea className="form-input" rows={4} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ resize: 'vertical' }} />
                  </div>
                  {updateDeal.isError && <ErrorMessage message={updateDeal.error?.message} />}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary btn-sm" disabled={updateDeal.isPending} onClick={() => updateDeal.mutate(form)}>{updateDeal.isPending ? 'Saving…' : 'Save Changes'}</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setEditing(false)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  <DetailRow label="Value"><MoneyDisplay amount={deal.value} currency={deal.currency || 'USD'} /></DetailRow>
                  <DetailRow label="Currency" value={(deal.currency || 'USD').toUpperCase()} />
                  <DetailRow label="Stage"><Badge label={deal.stage || 'lead'} /></DetailRow>
                  <DetailRow label="Probability" value={deal.probability != null ? `${deal.probability}%` : '—'} />
                  <DetailRow label="Expected Close" value={fmtDate(deal.expected_close_date)} />
                  <DetailRow label="Created" value={fmtDate(deal.created_at)} />
                  {deal.notes && <DetailRow label="Notes" value={deal.notes} style={{ gridColumn: '1 / -1' }} />}
                </div>
              )}
            </div>
          )}

          {tab === 'activity' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setTaskOpen(true)}>Add Task</button>
              </div>
              {tasks.length === 0 && comms.length === 0 && <p className="text-muted">No activity yet.</p>}
              {[...tasks.map(t => ({ ...t, _type: 'task' })), ...comms.map(c => ({ ...c, _type: 'comm' }))]
                .sort((a, b) => new Date(b.created_at || b.due_at) - new Date(a.created_at || a.due_at))
                .map((item, i) => (
                  <div key={`${item._type}-${item.id || i}`} className="card" style={{ padding: 14 }}>
                    {item._type === 'task' ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Badge label={item.priority || 'medium'} />
                        <span style={{ flex: 1, fontWeight: 500, fontSize: 14 }}>{item.title}</span>
                        {item.status && <Badge label={item.status} />}
                        {item.due_at && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Due {fmtDate(item.due_at)}</span>}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Badge label={item.channel || 'email'} color="blue" />
                        <Badge label={item.direction || 'outbound'} color="gray" />
                        <span style={{ flex: 1, fontWeight: 500, fontSize: 14 }}>{item.subject || item.content?.slice(0, 60)}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmtDate(item.created_at)}</span>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}

          {tab === 'contacts' && (
            <div>
              {linkedContact ? (
                <div className="card" style={{ padding: 20 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <DetailRow label="Name"><Link to={`/crm/contacts/${deal.contact_id}`} style={{ color: 'var(--accent)', fontWeight: 600 }}>{linkedContact.name}</Link></DetailRow>
                    <DetailRow label="Title" value={linkedContact.title || linkedContact.job_title} />
                    <DetailRow label="Email" value={linkedContact.email} mono />
                    <DetailRow label="Phone" value={linkedContact.phone} />
                  </div>
                </div>
              ) : (
                <p className="text-muted">No contact linked to this deal.</p>
              )}
            </div>
          )}

          {tab === 'quotes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-primary btn-sm" onClick={() => createQuote.mutate()} disabled={createQuote.isPending}>New Quote</button>
              </div>
              {quotes.length === 0 ? <p className="text-muted">No quotes yet.</p> : (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-subtle)' }}>
                        {['Title', 'Status', 'Total', 'Created'].map(h => (
                          <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: 12 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {quotes.map((q, i) => (
                        <tr key={q.id || i} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '10px 16px', fontWeight: 500 }}><Link to="/sales/quotes" style={{ color: 'var(--accent)' }}>{q.title}</Link></td>
                          <td style={{ padding: '10px 16px' }}><Badge label={q.status || 'draft'} /></td>
                          <td style={{ padding: '10px 16px' }}>{formatMoney(q.total ?? q.amount, q.currency || 'USD')}</td>
                          <td style={{ padding: '10px 16px', color: 'var(--text-muted)' }}>{fmtDate(q.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === 'notes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setNoteOpen(true)}>Add Note</button>
              </div>
              {notes.length === 0 ? <p className="text-muted">No notes yet.</p> : notes.map((n, i) => (
                <div key={n.id || i} className="card" style={{ padding: 16 }}>
                  <p style={{ margin: '0 0 8px', fontSize: 14, lineHeight: 1.6 }}>{n.content}</p>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmtDate(n.created_at)}</span>
                </div>
              ))}
            </div>
          )}

          {tab === 'timeline' && (
            <div className="card" style={{ padding: 24 }}>
              <Timeline events={timeline} />
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <WonModal open={wonOpen} onClose={() => setWonOpen(false)} deal={deal} isPending={markWon.isPending}
        onConfirm={({ value, closed_at }) => markWon.mutate({ value, closed_at })} />
      <LostModal open={lostOpen} onClose={() => setLostOpen(false)} isPending={markLost.isPending}
        onConfirm={({ reason, competitor }) => markLost.mutate({ reason, competitor })} />
      <TaskModal open={taskOpen} onClose={() => setTaskOpen(false)} isPending={createTask.isPending}
        onConfirm={body => createTask.mutate(body)} />
      <NoteModal open={noteOpen} onClose={() => setNoteOpen(false)} isPending={createNote.isPending}
        onConfirm={content => createNote.mutate(content)} />
      <ConfirmDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete Deal"
        message={`Permanently delete "${dealName}"? This cannot be undone.`}
        confirmLabel="Delete" variant="danger" isLoading={deleteDeal.isPending}
        onConfirm={() => deleteDeal.mutate()} />
    </div>
  )
}
