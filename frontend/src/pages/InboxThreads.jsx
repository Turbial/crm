import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { get, post, patch, del } from '../api'
import Spinner from '../components/Spinner'
import Badge from '../components/Badge'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'

const fmtDate = d => d ? new Date(d).toLocaleString() : '—'

function relTime(d) {
  if (!d) return '—'
  const diff = Date.now() - new Date(d).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

const CHANNEL_COLORS = {
  email: 'blue', sms: 'green', call: 'yellow',
  chat: 'purple', social: 'purple', internal: 'gray',
}

const STATUS_COLORS = {
  open: 'blue', snoozed: 'gray', resolved: 'green', spam: 'red',
}

const CHANNELS = ['email', 'sms', 'call', 'chat', 'social', 'internal']
const STATUSES = ['open', 'snoozed', 'resolved', 'spam']
const FILTER_TABS = [
  { key: '', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'resolved', label: 'Resolved' },
]

const BLANK_CREATE = { subject: '', channel: 'email', lead_id: '' }

export default function InboxThreads() {
  const qc = useQueryClient()
  const [tab, setTab] = useState('')
  const [selected, setSelected] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState(BLANK_CREATE)
  const [editStatus, setEditStatus] = useState('')
  const [editSubject, setEditSubject] = useState('')
  const [statusSaving, setStatusSaving] = useState(false)
  const [subjectSaving, setSubjectSaving] = useState(false)

  const { data: threads = [], isLoading } = useQuery({
    queryKey: ['inbox-threads'],
    queryFn: () => get('/inbox?limit=100'),
  })

  const selectedThread = threads.find(t => t.id === selected) || null

  function handleSelect(thread) {
    setSelected(thread.id)
    setEditStatus(thread.status || 'open')
    setEditSubject(thread.subject || '')
  }

  const createMut = useMutation({
    mutationFn: body => post('/inbox', body),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ['inbox-threads'] })
      setShowCreate(false)
      setCreateForm(BLANK_CREATE)
      handleSelect(t)
    },
  })

  const patchMut = useMutation({
    mutationFn: ({ id, body }) => patch(`/inbox/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inbox-threads'] }),
  })

  const deleteMut = useMutation({
    mutationFn: id => del(`/inbox/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inbox-threads'] })
      setSelected(null)
    },
  })

  function saveStatus() {
    if (!selectedThread) return
    setStatusSaving(true)
    patchMut.mutate({ id: selectedThread.id, body: { status: editStatus } }, { onSettled: () => setStatusSaving(false) })
  }

  function saveSubject() {
    if (!selectedThread) return
    setSubjectSaving(true)
    patchMut.mutate({ id: selectedThread.id, body: { subject: editSubject } }, { onSettled: () => setSubjectSaving(false) })
  }

  function handleDelete() {
    if (!selectedThread) return
    if (!window.confirm('Delete this thread?')) return
    deleteMut.mutate(selectedThread.id)
  }

  const visible = tab ? threads.filter(t => t.status === tab) : threads

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      <div style={{ width: 340, flexShrink: 0, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="font-medium">Inbox</span>
          <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={() => setShowCreate(true)}>
            New Thread
          </button>
        </div>
        <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 4 }}>
          {FILTER_TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: '4px 10px',
                fontSize: 13,
                borderRadius: 4,
                border: 'none',
                cursor: 'pointer',
                background: tab === t.key ? 'var(--primary, #2563eb)' : 'transparent',
                color: tab === t.key ? '#fff' : 'inherit',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {isLoading ? (
            <div style={{ padding: 16 }}><Spinner /></div>
          ) : visible.length === 0 ? (
            <div style={{ padding: 16 }}><EmptyState title="No threads" /></div>
          ) : (
            visible.map(thread => (
              <div
                key={thread.id}
                onClick={() => handleSelect(thread)}
                style={{
                  padding: '12px 16px',
                  cursor: 'pointer',
                  borderBottom: '1px solid var(--border)',
                  background: selected === thread.id ? 'var(--bg-hover, #f5f5f5)' : 'transparent',
                }}
              >
                <div className="font-medium text-sm" style={{ marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {thread.subject || '(no subject)'}
                </div>
                <div className="flex gap-2 items-center" style={{ flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
                  <Badge label={thread.channel} color={CHANNEL_COLORS[thread.channel] || 'gray'} />
                  <Badge label={thread.status} color={STATUS_COLORS[thread.status] || 'gray'} />
                  {thread.lead_id && (
                    <span className="badge badge-gray text-xs">{String(thread.lead_id).slice(0, 8)}</span>
                  )}
                </div>
                <div className="td-muted text-xs">{relTime(thread.last_message_at)}</div>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        {!selectedThread ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <EmptyState title="Select a thread to view" />
          </div>
        ) : (
          <div style={{ maxWidth: 640 }}>
            <div style={{ marginBottom: 24 }}>
              <div className="flex gap-2 items-center" style={{ marginBottom: 8 }}>
                <h1 style={{ margin: 0, fontSize: 20 }}>{selectedThread.subject || '(no subject)'}</h1>
                <Badge label={selectedThread.channel} color={CHANNEL_COLORS[selectedThread.channel] || 'gray'} />
                <Badge label={selectedThread.status} color={STATUS_COLORS[selectedThread.status] || 'gray'} />
              </div>
              {selectedThread.lead_id && (
                <div className="td-muted text-sm" style={{ marginBottom: 4 }}>
                  Lead: <span className="badge badge-gray">{String(selectedThread.lead_id).slice(0, 8)}</span>
                </div>
              )}
              <div className="td-muted text-xs">
                Created: {fmtDate(selectedThread.created_at)} · Last message: {fmtDate(selectedThread.last_message_at)}
              </div>
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
              <div className="font-medium text-sm" style={{ marginBottom: 12 }}>Update Status</div>
              <div className="flex gap-2 items-center">
                <select
                  className="form-input"
                  value={editStatus}
                  onChange={e => setEditStatus(e.target.value)}
                  style={{ width: 160 }}
                >
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={saveStatus}
                  disabled={statusSaving || patchMut.isPending}
                >
                  {statusSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
              <div className="font-medium text-sm" style={{ marginBottom: 12 }}>Edit Subject</div>
              <div className="flex gap-2 items-center">
                <input
                  className="form-input"
                  style={{ flex: 1 }}
                  value={editSubject}
                  onChange={e => setEditSubject(e.target.value)}
                  placeholder="Thread subject"
                />
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={saveSubject}
                  disabled={subjectSaving || patchMut.isPending}
                >
                  {subjectSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>

            {patchMut.isError && (
              <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{patchMut.error?.message}</p>
            )}

            <button
              className="btn btn-danger btn-sm"
              onClick={handleDelete}
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending ? 'Deleting…' : 'Delete Thread'}
            </button>
          </div>
        )}
      </div>

      <Modal
        open={showCreate}
        onClose={() => { setShowCreate(false); setCreateForm(BLANK_CREATE) }}
        title="New Thread"
        footer={
          <div className="flex gap-2 items-center" style={{ justifyContent: 'flex-end', width: '100%' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => { setShowCreate(false); setCreateForm(BLANK_CREATE) }}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              disabled={createMut.isPending || !createForm.subject.trim()}
              onClick={() => createMut.mutate({
                subject: createForm.subject,
                channel: createForm.channel,
                lead_id: createForm.lead_id || undefined,
              })}
            >
              {createMut.isPending ? 'Creating…' : 'Create'}
            </button>
          </div>
        }
      >
        <div className="form-group">
          <label className="form-label">Subject *</label>
          <input
            className="form-input"
            autoFocus
            value={createForm.subject}
            onChange={e => setCreateForm(f => ({ ...f, subject: e.target.value }))}
            placeholder="Thread subject"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Channel</label>
          <select
            className="form-input"
            value={createForm.channel}
            onChange={e => setCreateForm(f => ({ ...f, channel: e.target.value }))}
          >
            {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Lead ID (optional)</label>
          <input
            className="form-input"
            value={createForm.lead_id}
            onChange={e => setCreateForm(f => ({ ...f, lead_id: e.target.value }))}
            placeholder="Lead UUID"
          />
        </div>
        {createMut.isError && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{createMut.error?.message}</p>}
      </Modal>
    </div>
  )
}
