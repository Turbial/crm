import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Clock, Trash2 } from 'lucide-react'
import { get, post, del } from '../../api'
import Spinner from '../../components/Spinner'
import Badge from '../../components/Badge'
import EmptyState from '../../components/EmptyState'
import Modal from '../../components/Modal'

const CHANNELS = ['email', 'sms']
const STATUSES = ['pending', 'sent', 'failed', 'cancelled']
const BLANK = { channel: 'email', recipient: '', body: '', scheduled_at: '' }

export default function ScheduledMessages() {
  const qc = useQueryClient()
  const [filterStatus, setFilterStatus] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState(BLANK)

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['scheduled-messages', filterStatus],
    queryFn: () => get('/scheduled-messages', { limit: 100, ...(filterStatus ? { status: filterStatus } : {}) }),
  })

  const createMut = useMutation({
    mutationFn: body => post('/scheduled-messages', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['scheduled-messages'] }); setShowCreate(false); setForm(BLANK) },
  })

  const deleteMut = useMutation({
    mutationFn: id => del(`/scheduled-messages/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scheduled-messages'] }),
  })

  function closeCreate() {
    setShowCreate(false)
    setForm(BLANK)
  }

  if (isLoading) return <Spinner />

  const visible = filterStatus
    ? messages.filter(m => m.status === filterStatus)
    : messages

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Scheduled Messages</h1>
          <p>{visible.length} message{visible.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2 items-center">
          <select
            className="form-input"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            style={{ width: 150 }}
          >
            <option value="">All statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={15} /> Schedule Message
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No scheduled messages"
          description="Schedule a message to send it at a specific time."
          action={<button className="btn btn-primary" onClick={() => setShowCreate(true)}>Schedule Message</button>}
        />
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Channel</th>
                  <th>Recipient</th>
                  <th>Message</th>
                  <th>Scheduled At</th>
                  <th>Status</th>
                  <th>Sent At</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visible.map(m => (
                  <tr key={m.id}>
                    <td><Badge label={m.channel} /></td>
                    <td className="font-medium">{m.recipient}</td>
                    <td className="td-muted text-sm" style={{ maxWidth: 240 }}>
                      <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.body.length > 60 ? m.body.slice(0, 60) + '…' : m.body}
                      </span>
                    </td>
                    <td className="td-muted text-sm">
                      {m.scheduled_at ? new Date(m.scheduled_at).toLocaleString() : '—'}
                    </td>
                    <td><Badge label={m.status} /></td>
                    <td className="td-muted text-sm">
                      {m.sent_at ? new Date(m.sent_at).toLocaleString() : '—'}
                    </td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        disabled={deleteMut.isPending}
                        onClick={() => { if (window.confirm('Delete this scheduled message?')) deleteMut.mutate(m.id) }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={showCreate}
        onClose={closeCreate}
        title="Schedule Message"
        footer={
          <>
            <button className="btn btn-secondary btn-sm" onClick={closeCreate}>Cancel</button>
            <button
              className="btn btn-primary"
              disabled={createMut.isPending || !form.recipient.trim() || !form.body.trim() || !form.scheduled_at}
              onClick={() => createMut.mutate(form)}
            >
              {createMut.isPending ? 'Scheduling…' : 'Schedule'}
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Channel</label>
          <select
            className="form-input"
            value={form.channel}
            onChange={e => setForm(f => ({ ...f, channel: e.target.value }))}
          >
            {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Recipient *</label>
          <input
            className="form-input"
            autoFocus
            value={form.recipient}
            onChange={e => setForm(f => ({ ...f, recipient: e.target.value }))}
            placeholder={form.channel === 'email' ? 'email@example.com' : '+1 555 000 0000'}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Message *</label>
          <textarea
            className="form-input"
            rows={4}
            value={form.body}
            onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
            placeholder="Message body…"
            style={{ resize: 'vertical' }}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Scheduled At *</label>
          <input
            className="form-input"
            type="datetime-local"
            value={form.scheduled_at}
            onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))}
          />
        </div>
        {createMut.error && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{createMut.error.message}</p>}
      </Modal>
    </div>
  )
}
