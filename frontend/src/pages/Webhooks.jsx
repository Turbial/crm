import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Webhook } from 'lucide-react'
import { get, post, patch, del } from '../api'
import Spinner from '../components/Spinner'
import Badge from '../components/Badge'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'

const fmtDate = d => d ? new Date(d).toLocaleString() : '—'

const statusColor = s => {
  if (!s) return 'gray'
  if (s >= 200 && s < 300) return 'green'
  return 'red'
}

const statusLabel = s => {
  if (!s) return '—'
  if (s >= 200 && s < 300) return 'success'
  return 'failed'
}

const emptyCreate = { url: '', events: '', secret: '' }
const emptyEdit = { url: '', events: '', is_active: true }

export default function Webhooks() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [createForm, setCreateForm] = useState(emptyCreate)
  const [editForm, setEditForm] = useState(emptyEdit)

  const { data: webhooks = [], isLoading } = useQuery({
    queryKey: ['webhooks-out'],
    queryFn: () => get('/webhooks-out', { limit: 100 }),
  })

  const createMut = useMutation({
    mutationFn: body => post('/webhooks-out', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webhooks-out'] })
      setShowCreate(false)
      setCreateForm(emptyCreate)
    },
  })

  const editMut = useMutation({
    mutationFn: body => patch(`/webhooks-out/${editTarget?.id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webhooks-out'] })
      setEditTarget(null)
    },
  })

  const deleteMut = useMutation({
    mutationFn: () => del(`/webhooks-out/${editTarget?.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webhooks-out'] })
      setEditTarget(null)
    },
  })

  function openEdit(wh) {
    setEditTarget(wh)
    setEditForm({
      url: wh.url,
      events: Array.isArray(wh.events) ? wh.events.join('\n') : (wh.events || ''),
      is_active: wh.is_active,
    })
  }

  function submitCreate() {
    const events = createForm.events.split('\n').map(s => s.trim()).filter(Boolean)
    createMut.mutate({ url: createForm.url, events, secret: createForm.secret || undefined })
  }

  function submitEdit() {
    const events = editForm.events.split('\n').map(s => s.trim()).filter(Boolean)
    editMut.mutate({ url: editForm.url, events, is_active: editForm.is_active })
  }

  if (isLoading) return <Spinner />

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Outbound Webhooks</h1>
          <p>{webhooks.length} webhook{webhooks.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={15} /> Add Webhook
        </button>
      </div>

      {webhooks.length === 0
        ? (
          <EmptyState
            icon={Webhook}
            title="No webhooks configured"
            description="Add an outbound webhook to receive real-time event notifications."
            action={<button className="btn btn-primary" onClick={() => setShowCreate(true)}>Add Webhook</button>}
          />
        )
        : (
          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>URL</th>
                    <th>Events</th>
                    <th>Active</th>
                    <th>Last Delivery</th>
                    <th>Last Status</th>
                  </tr>
                </thead>
                <tbody>
                  {webhooks.map(wh => (
                    <tr key={wh.id} style={{ cursor: 'pointer' }} onClick={() => openEdit(wh)}>
                      <td className="font-medium" style={{ maxWidth: 280 }}>
                        <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {wh.url}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-2" style={{ flexWrap: 'wrap', gap: 4 }}>
                          {(Array.isArray(wh.events) ? wh.events : []).slice(0, 3).map(ev => (
                            <span key={ev} className="badge badge-blue text-xs">{ev}</span>
                          ))}
                          {(Array.isArray(wh.events) ? wh.events : []).length > 3 && (
                            <span className="badge badge-gray text-xs">+{wh.events.length - 3}</span>
                          )}
                        </div>
                      </td>
                      <td><Badge label={wh.is_active ? 'active' : 'inactive'} /></td>
                      <td className="td-muted text-sm">{fmtDate(wh.last_delivery_at)}</td>
                      <td>
                        {wh.last_status
                          ? <Badge label={statusLabel(wh.last_status)} color={statusColor(wh.last_status)} />
                          : <span className="td-muted">—</span>}
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
        onClose={() => { setShowCreate(false); setCreateForm(emptyCreate) }}
        title="Add Webhook"
        footer={
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => { setShowCreate(false); setCreateForm(emptyCreate) }}>Cancel</button>
            <button className="btn btn-primary" disabled={createMut.isPending || !createForm.url} onClick={submitCreate}>
              {createMut.isPending ? 'Adding…' : 'Add Webhook'}
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">URL *</label>
          <input
            className="form-input"
            placeholder="https://example.com/webhook"
            value={createForm.url}
            onChange={e => setCreateForm(f => ({ ...f, url: e.target.value }))}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Events (one per line)</label>
          <textarea
            className="form-input"
            rows={5}
            placeholder={'lead.created\nlead.updated\ndeal.won'}
            value={createForm.events}
            onChange={e => setCreateForm(f => ({ ...f, events: e.target.value }))}
            style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: 13 }}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Secret (optional)</label>
          <input
            className="form-input"
            type="password"
            placeholder="Signing secret"
            value={createForm.secret}
            onChange={e => setCreateForm(f => ({ ...f, secret: e.target.value }))}
          />
        </div>
        {createMut.isError && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{createMut.error.message}</p>}
      </Modal>

      <Modal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Edit Webhook"
        footer={
          <div className="flex gap-2 items-center" style={{ justifyContent: 'space-between', width: '100%' }}>
            <button
              className="btn btn-danger btn-sm"
              disabled={deleteMut.isPending}
              onClick={() => deleteMut.mutate()}
            >
              {deleteMut.isPending ? 'Deleting…' : 'Delete'}
            </button>
            <div className="flex gap-2">
              <button className="btn btn-secondary btn-sm" onClick={() => setEditTarget(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={editMut.isPending || !editForm.url} onClick={submitEdit}>
                {editMut.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        }
      >
        <div className="form-group">
          <label className="form-label">URL *</label>
          <input
            className="form-input"
            value={editForm.url}
            onChange={e => setEditForm(f => ({ ...f, url: e.target.value }))}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Events (one per line)</label>
          <textarea
            className="form-input"
            rows={5}
            value={editForm.events}
            onChange={e => setEditForm(f => ({ ...f, events: e.target.value }))}
            style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: 13 }}
          />
        </div>
        <div className="form-group">
          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={editForm.is_active}
              onChange={e => setEditForm(f => ({ ...f, is_active: e.target.checked }))}
            />
            Active
          </label>
        </div>
        {(editMut.isError || deleteMut.isError) && (
          <p style={{ color: 'var(--danger)', fontSize: 13 }}>
            {(editMut.error || deleteMut.error)?.message}
          </p>
        )}
      </Modal>
    </div>
  )
}
