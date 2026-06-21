import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, MessageSquare } from 'lucide-react'
import { get, post } from '../../api'
import Spinner from '../../components/Spinner'
import Badge from '../../components/Badge'
import EmptyState from '../../components/EmptyState'
import Modal from '../../components/Modal'

const CHANNELS = ['email', 'sms', 'call', 'chat', 'social', 'internal']
const DIRECTIONS = ['inbound', 'outbound', 'internal']
const CHANNEL_COLORS = { email: 'blue', sms: 'green', call: 'yellow', chat: 'purple', social: 'gray', internal: 'gray' }
const DIRECTION_COLORS = { inbound: 'blue', outbound: 'green', internal: 'gray' }

const fmtDate = d => d ? new Date(d).toLocaleString() : '—'

function nowLocal() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

const EMPTY_FORM = { lead_id: '', channel: 'email', direction: 'outbound', subject: '', body: '', occurred_at: nowLocal() }

export default function Communications() {
  const qc = useQueryClient()
  const [channelFilter, setChannelFilter] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const { data: comms = [], isLoading } = useQuery({
    queryKey: ['communications'],
    queryFn: () => get('/communications', { limit: 200 }),
    refetchInterval: 60000,
  })

  const create = useMutation({
    mutationFn: body => post('/communications', {
      lead_id: body.lead_id || undefined,
      channel: body.channel,
      direction: body.direction,
      subject: body.subject || undefined,
      body: body.body,
      occurred_at: body.occurred_at ? new Date(body.occurred_at).toISOString() : undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['communications'] }); setShowCreate(false); setForm({ ...EMPTY_FORM, occurred_at: nowLocal() }) },
  })

  const filtered = comms
    .filter(c => !channelFilter || c.channel === channelFilter)
    .filter(c => !debouncedSearch || c.subject?.toLowerCase().includes(debouncedSearch.toLowerCase()))

  if (isLoading) return <Spinner />

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Communications</h1>
          <p>{filtered.length} records</p>
        </div>
        <div className="flex gap-2 items-center">
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              className="form-input"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by subject…"
              style={{ width: 200, paddingLeft: 32 }}
            />
          </div>
          <select className="form-input" value={channelFilter} onChange={e => setChannelFilter(e.target.value)} style={{ width: 150 }}>
            <option value="">All channels</option>
            {CHANNELS.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
          </select>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}><Plus size={15} /> Log Communication</button>
        </div>
      </div>

      {filtered.length === 0
        ? <EmptyState icon={MessageSquare} title="No communications yet" description="Log your first communication to track interactions." action={<button className="btn btn-primary" onClick={() => setShowCreate(true)}>Log communication</button>} />
        : (
          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Channel</th><th>Direction</th><th>Subject</th><th>Body Preview</th><th>Lead</th><th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => (
                    <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(c)}>
                      <td><Badge label={c.channel} color={CHANNEL_COLORS[c.channel]} /></td>
                      <td><Badge label={c.direction} color={DIRECTION_COLORS[c.direction]} /></td>
                      <td className="font-medium text-sm">{c.subject ? c.subject.slice(0, 50) : '—'}</td>
                      <td className="td-muted" style={{ maxWidth: 200 }}>{c.body ? c.body.slice(0, 80) + (c.body.length > 80 ? '…' : '') : '—'}</td>
                      <td className="td-muted">{c.lead_id ? String(c.lead_id).slice(0, 8) : '—'}</td>
                      <td className="td-muted">{fmtDate(c.occurred_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      <Modal open={showCreate} onClose={() => { setShowCreate(false); setForm({ ...EMPTY_FORM, occurred_at: nowLocal() }) }} title="Log Communication"
        footer={<>
          <button className="btn btn-secondary" onClick={() => { setShowCreate(false); setForm({ ...EMPTY_FORM, occurred_at: nowLocal() }) }}>Cancel</button>
          <button className="btn btn-primary" disabled={create.isPending || !form.body.trim()} onClick={() => create.mutate(form)}>
            {create.isPending ? 'Saving…' : 'Save'}
          </button>
        </>}>
        <div className="form-group">
          <label className="form-label">Lead ID</label>
          <input className="form-input" value={form.lead_id} onChange={e => setForm(f => ({ ...f, lead_id: e.target.value }))} placeholder="Lead ID" />
        </div>
        <div className="form-group">
          <label className="form-label">Channel</label>
          <select className="form-input" value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))}>
            {CHANNELS.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Direction</label>
          <select className="form-input" value={form.direction} onChange={e => setForm(f => ({ ...f, direction: e.target.value }))}>
            {DIRECTIONS.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Subject</label>
          <input className="form-input" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="Subject" />
        </div>
        <div className="form-group">
          <label className="form-label">Body</label>
          <textarea className="form-input" rows={4} value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} placeholder="Message body…" />
        </div>
        <div className="form-group">
          <label className="form-label">Occurred At</label>
          <input className="form-input" type="datetime-local" value={form.occurred_at} onChange={e => setForm(f => ({ ...f, occurred_at: e.target.value }))} />
        </div>
        {create.isError && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{create.error.message}</p>}
      </Modal>

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Communication Detail"
        footer={<button className="btn btn-secondary" onClick={() => setSelected(null)}>Close</button>}>
        {selected && (
          <>
            <div className="form-group">
              <label className="form-label">Channel</label>
              <div><Badge label={selected.channel} color={CHANNEL_COLORS[selected.channel]} /></div>
            </div>
            <div className="form-group">
              <label className="form-label">Direction</label>
              <div><Badge label={selected.direction} color={DIRECTION_COLORS[selected.direction]} /></div>
            </div>
            <div className="form-group">
              <label className="form-label">Subject</label>
              <p className="font-medium text-sm" style={{ margin: 0 }}>{selected.subject || '—'}</p>
            </div>
            <div className="form-group">
              <label className="form-label">Body</label>
              <p style={{ margin: 0, fontSize: 14, whiteSpace: 'pre-wrap', color: 'var(--text)' }}>{selected.body || '—'}</p>
            </div>
            <div className="form-group">
              <label className="form-label">Lead ID</label>
              <p className="td-muted" style={{ margin: 0 }}>{selected.lead_id || '—'}</p>
            </div>
            <div className="form-group">
              <label className="form-label">Occurred At</label>
              <p className="td-muted" style={{ margin: 0 }}>{fmtDate(selected.occurred_at)}</p>
            </div>
            <div className="form-group">
              <label className="form-label">Logged At</label>
              <p className="td-muted" style={{ margin: 0 }}>{fmtDate(selected.created_at)}</p>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
