import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { MessageSquare, Plus, X } from 'lucide-react'
import { get, post } from '../../api'
import Spinner from '../../components/Spinner'
import Badge from '../../components/Badge'
import EmptyState from '../../components/EmptyState'

const STATUS_TABS = [
  { key: 'open', label: 'Open' },
  { key: 'pending', label: 'Pending' },
  { key: 'snoozed', label: 'Snoozed' },
  { key: 'resolved', label: 'Resolved' },
]

const CHANNELS = ['all', 'internal', 'email', 'sms', 'whatsapp', 'telegram', 'web', 'messenger']

const CHANNEL_BADGE = {
  email: 'blue', sms: 'green', whatsapp: 'green',
  telegram: 'purple', web: 'gray', internal: 'gray', messenger: 'purple',
}

const PRIORITY_DOT = {
  urgent: 'var(--danger)', high: 'var(--warning)',
  normal: 'var(--border)', low: 'var(--border)',
}

function NewConvoModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState({ subject: '', channel: 'internal' })
  const mut = useMutation({
    mutationFn: () => post('/conversations', form),
    onSuccess: c => { onCreated(c.id); onClose() },
  })

  if (!open) return null
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <h2>New Conversation</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Subject</label>
            <input
              className="form-input"
              value={form.subject}
              onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
              placeholder="Conversation subject…"
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label">Channel</label>
            <select
              className="form-input"
              value={form.channel}
              onChange={e => setForm(f => ({ ...f, channel: e.target.value }))}
            >
              {['internal', 'email', 'sms', 'whatsapp', 'telegram', 'web', 'messenger'].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          {mut.isError && (
            <p style={{ color: 'var(--danger)', fontSize: 13 }}>{mut.error?.message}</p>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function MessengerInbox() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('open')
  const [channel, setChannel] = useState('all')
  const [newOpen, setNewOpen] = useState(false)

  const { data: convos = [], isLoading } = useQuery({
    queryKey: ['conversations', status, channel],
    queryFn: () => get('/conversations', {
      status,
      limit: 100,
      ...(channel !== 'all' ? { channel } : {}),
    }),
  })

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Messenger</h1>
          <p>Omnichannel conversation inbox</p>
        </div>
        <button className="btn btn-primary" onClick={() => setNewOpen(true)}>
          <Plus size={15} /> New Conversation
        </button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="tab-bar">
          {STATUS_TABS.map(t => (
            <button
              key={t.key}
              className={`tab-item${status === t.key ? ' active' : ''}`}
              onClick={() => setStatus(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <select
          className="form-input"
          value={channel}
          onChange={e => setChannel(e.target.value)}
          style={{ width: 150, fontSize: 13 }}
        >
          {CHANNELS.map(c => (
            <option key={c} value={c}>{c === 'all' ? 'All channels' : c}</option>
          ))}
        </select>
      </div>

      {isLoading
        ? <Spinner />
        : convos.length === 0
          ? (
            <EmptyState
              icon={MessageSquare}
              title="No conversations"
              description="Conversations appear here when contacts reach out or you create one."
            />
          )
          : (
            <div className="card" style={{ padding: 0 }}>
              {convos.map(c => (
                <div
                  key={c.id}
                  className="convo-item"
                  onClick={() => navigate(`/messenger/${c.id}`)}
                >
                  <div
                    className="priority-dot"
                    style={{ background: PRIORITY_DOT[c.priority] || PRIORITY_DOT.normal, marginTop: 6 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="convo-name truncate">
                        {c.subject || `Conversation #${c.id.slice(0, 8)}`}
                      </span>
                      <Badge label={c.channel} color={CHANNEL_BADGE[c.channel] || 'gray'} />
                      {c.priority && c.priority !== 'normal' && (
                        <Badge
                          label={c.priority}
                          color={c.priority === 'urgent' ? 'red' : 'yellow'}
                        />
                      )}
                    </div>
                    <span className="convo-preview">
                      {c.assigned_user_id ? 'Assigned' : 'Unassigned'}
                    </span>
                  </div>
                  <span className="convo-time">
                    {c.updated_at ? new Date(c.updated_at).toLocaleDateString() : ''}
                  </span>
                </div>
              ))}
            </div>
          )
      }

      <NewConvoModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={id => navigate(`/messenger/${id}`)}
      />
    </div>
  )
}
