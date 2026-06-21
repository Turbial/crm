import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { get, post, patch, del } from '../../api'
import Spinner from '../../components/Spinner'
import Badge from '../../components/Badge'
import EmptyState from '../../components/EmptyState'
import Modal from '../../components/Modal'

const fmtDate = d => d ? new Date(d).toLocaleString() : '—'

const PLATFORMS = ['google', 'trustpilot', 'g2', 'capterra', 'yelp', 'facebook', 'other']
const STATUSES = ['pending', 'sent', 'received', 'flagged']

const PLATFORM_COLORS = {
  google: 'blue', trustpilot: 'green', g2: 'red',
  capterra: 'purple', yelp: 'red', facebook: 'blue', other: 'gray',
}

const STATUS_COLORS = {
  pending: 'blue', sent: 'yellow', received: 'green', flagged: 'red',
}

function Stars({ rating }) {
  if (!rating) return <span className="td-muted">—</span>
  return <span style={{ color: '#f59e0b', letterSpacing: 1 }}>{'★'.repeat(rating)}{'☆'.repeat(5 - rating)}</span>
}

function toDateInput(isoStr) {
  if (!isoStr) return ''
  return isoStr.slice(0, 10)
}

const BLANK_CREATE = { platform: 'google', lead_id: '', contact_id: '', status: 'pending' }
const BLANK_EDIT = { status: 'pending', rating: '', review_text: '', received_at: '' }

export default function Reviews() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState(BLANK_CREATE)
  const [editTarget, setEditTarget] = useState(null)
  const [editForm, setEditForm] = useState(BLANK_EDIT)

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ['reviews'],
    queryFn: () => get('/reviews?limit=100'),
  })

  const createMut = useMutation({
    mutationFn: body => post('/reviews', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reviews'] })
      setShowCreate(false)
      setCreateForm(BLANK_CREATE)
    },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, body }) => patch(`/reviews/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reviews'] })
      setEditTarget(null)
    },
  })

  const deleteMut = useMutation({
    mutationFn: id => del(`/reviews/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reviews'] })
      setEditTarget(null)
    },
  })

  function openEdit(r) {
    setEditTarget(r)
    setEditForm({
      status: r.status || 'pending',
      rating: r.rating != null ? String(r.rating) : '',
      review_text: r.review_text || '',
      received_at: toDateInput(r.received_at),
    })
  }

  function submitEdit() {
    updateMut.mutate({
      id: editTarget.id,
      body: {
        status: editForm.status,
        rating: editForm.rating !== '' ? Number(editForm.rating) : null,
        review_text: editForm.review_text || null,
        received_at: editForm.received_at ? new Date(editForm.received_at).toISOString() : null,
      },
    })
  }

  function handleDelete() {
    if (!editTarget) return
    if (!window.confirm('Delete this review?')) return
    deleteMut.mutate(editTarget.id)
  }

  const filtered = statusFilter ? reviews.filter(r => r.status === statusFilter) : reviews

  const received = reviews.filter(r => r.status === 'received')
  const ratings = received.map(r => r.rating).filter(r => r != null)
  const avgRating = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : null

  if (isLoading) return <Spinner />

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Reviews</h1>
          <p className="td-muted text-sm">
            {reviews.length} total · {received.length} received
            {avgRating ? ` · avg ${avgRating} ★` : ''}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <select
            className="form-input"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ width: 160 }}
          >
            <option value="">All Statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            Request Review
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No reviews found" description="Request a review to get started." />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Platform</th>
                <th>Status</th>
                <th>Rating</th>
                <th>Lead</th>
                <th>Contact</th>
                <th>Requested At</th>
                <th>Received At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id}>
                  <td><Badge label={r.platform} color={PLATFORM_COLORS[r.platform] || 'gray'} /></td>
                  <td><Badge label={r.status} color={STATUS_COLORS[r.status] || 'gray'} /></td>
                  <td><Stars rating={r.rating} /></td>
                  <td className="td-muted text-sm">{r.lead_id ? String(r.lead_id).slice(0, 8) : '—'}</td>
                  <td className="td-muted text-sm">{r.contact_id ? String(r.contact_id).slice(0, 8) : '—'}</td>
                  <td className="td-muted text-sm">{fmtDate(r.requested_at || r.created_at)}</td>
                  <td className="td-muted text-sm">{fmtDate(r.received_at)}</td>
                  <td>
                    <button className="btn btn-secondary btn-sm" onClick={() => openEdit(r)}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={showCreate}
        onClose={() => { setShowCreate(false); setCreateForm(BLANK_CREATE) }}
        title="Request Review"
        footer={
          <div className="flex gap-2 items-center" style={{ justifyContent: 'flex-end', width: '100%' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => { setShowCreate(false); setCreateForm(BLANK_CREATE) }}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              disabled={createMut.isPending}
              onClick={() => createMut.mutate({
                platform: createForm.platform,
                lead_id: createForm.lead_id || undefined,
                contact_id: createForm.contact_id || undefined,
                status: createForm.status,
              })}
            >
              {createMut.isPending ? 'Requesting…' : 'Request'}
            </button>
          </div>
        }
      >
        <div className="form-group">
          <label className="form-label">Platform</label>
          <select
            className="form-input"
            value={createForm.platform}
            onChange={e => setCreateForm(f => ({ ...f, platform: e.target.value }))}
          >
            {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
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
        <div className="form-group">
          <label className="form-label">Contact ID (optional)</label>
          <input
            className="form-input"
            value={createForm.contact_id}
            onChange={e => setCreateForm(f => ({ ...f, contact_id: e.target.value }))}
            placeholder="Contact UUID"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Initial Status</label>
          <select
            className="form-input"
            value={createForm.status}
            onChange={e => setCreateForm(f => ({ ...f, status: e.target.value }))}
          >
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {createMut.isError && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{createMut.error?.message}</p>}
      </Modal>

      <Modal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Edit Review"
        footer={
          <div className="flex gap-2 items-center" style={{ justifyContent: 'space-between', width: '100%' }}>
            <button
              className="btn btn-danger btn-sm"
              disabled={deleteMut.isPending}
              onClick={handleDelete}
            >
              {deleteMut.isPending ? 'Deleting…' : 'Delete'}
            </button>
            <div className="flex gap-2">
              <button className="btn btn-secondary btn-sm" onClick={() => setEditTarget(null)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                disabled={updateMut.isPending}
                onClick={submitEdit}
              >
                {updateMut.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        }
      >
        <div className="form-group">
          <label className="form-label">Status</label>
          <select
            className="form-input"
            value={editForm.status}
            onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
          >
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Rating (1–5)</label>
          <input
            className="form-input"
            type="number"
            min={1}
            max={5}
            value={editForm.rating}
            onChange={e => setEditForm(f => ({ ...f, rating: e.target.value }))}
            placeholder="Leave blank if not rated"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Review Text</label>
          <textarea
            className="form-input"
            rows={4}
            value={editForm.review_text}
            onChange={e => setEditForm(f => ({ ...f, review_text: e.target.value }))}
            placeholder="Review content…"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Received At</label>
          <input
            className="form-input"
            type="date"
            value={editForm.received_at}
            onChange={e => setEditForm(f => ({ ...f, received_at: e.target.value }))}
          />
        </div>
        {(updateMut.isError || deleteMut.isError) && (
          <p style={{ color: 'var(--danger)', fontSize: 13 }}>{(updateMut.error || deleteMut.error)?.message}</p>
        )}
      </Modal>
    </div>
  )
}
