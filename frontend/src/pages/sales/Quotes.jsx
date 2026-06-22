import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { get, post, patch, del } from '../../api'
import Spinner from '../../components/Spinner'
import Badge from '../../components/Badge'
import EmptyState from '../../components/EmptyState'
import Modal from '../../components/Modal'

const fmtDate = (d) => d ? new Date(d).toLocaleString() : '—'
const fmtCurrency = (n) =>
  n == null
    ? '—'
    : new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }).format(n)

const STATUS_COLORS = {
  draft: 'gray',
  sent: 'blue',
  accepted: 'green',
  rejected: 'red',
  expired: 'yellow',
}

const EMPTY_CREATE_FORM = {
  title: '',
  lead_id: '',
  total_amount: '',
  currency: 'USD',
  valid_until: '',
}

const EMPTY_EDIT_FORM = {
  title: '',
  status: 'draft',
  valid_until: '',
}

function toDateInput(isoStr) {
  if (!isoStr) return ''
  return isoStr.slice(0, 10)
}

export default function Quotes() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [modalMode, setModalMode] = useState(null)
  const [editing, setEditing] = useState(null)
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM)
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM)

  const { data: quotes = [], isLoading } = useQuery({
    queryKey: ['quotes'],
    queryFn: () => get('/quotes?limit=100'),
  })

  const createMutation = useMutation({
    mutationFn: (body) => post('/quotes', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['quotes'] }); closeModal() },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }) => patch(`/quotes/${id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['quotes'] }); closeModal() },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => del(`/quotes/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['quotes'] }); closeModal() },
  })

  function openCreate() {
    setEditing(null)
    setCreateForm(EMPTY_CREATE_FORM)
    setModalMode('create')
  }

  function openEdit(quote) {
    setEditing(quote)
    setEditForm({
      title: quote.title || '',
      status: quote.status || 'draft',
      valid_until: toDateInput(quote.valid_until),
    })
    setModalMode('edit')
  }

  function closeModal() {
    setModalMode(null)
    setEditing(null)
    setCreateForm(EMPTY_CREATE_FORM)
    setEditForm(EMPTY_EDIT_FORM)
  }

  function handleCreateChange(e) {
    const { name, value } = e.target
    setCreateForm((f) => ({ ...f, [name]: value }))
  }

  function handleEditChange(e) {
    const { name, value } = e.target
    setEditForm((f) => ({ ...f, [name]: value }))
  }

  function handleCreateSubmit(e) {
    e.preventDefault()
    const body = {
      title: createForm.title,
      lead_id: createForm.lead_id || undefined,
      total_amount: createForm.total_amount !== '' ? Number(createForm.total_amount) : undefined,
      currency: createForm.currency || 'USD',
      valid_until: createForm.valid_until || undefined,
    }
    createMutation.mutate(body)
  }

  function handleEditSubmit(e) {
    e.preventDefault()
    const body = {
      title: editForm.title,
      status: editForm.status,
      valid_until: editForm.valid_until || undefined,
    }
    updateMutation.mutate({ id: editing.id, body })
  }

  const filtered = statusFilter
    ? quotes.filter((q) => q.status === statusFilter)
    : quotes

  return (
    <div>
      <div className="page-header">
        <h1>Quotes</h1>
        <div className="flex gap-2 items-center">
          <select
            className="form-input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
            <option value="expired">Expired</option>
          </select>
          <button className="btn btn-primary" onClick={openCreate}>
            New Quote
          </button>
        </div>
      </div>

      {isLoading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <EmptyState message="No quotes found." />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Lead ID</th>
                <th>Total</th>
                <th>Status</th>
                <th>Valid Until</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((quote) => (
                <tr
                  key={quote.id}
                  onClick={() => navigate(`/sales/quotes/${quote.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <td className="font-medium">{quote.title}</td>
                  <td className="td-muted text-sm">
                    {quote.lead_id ? String(quote.lead_id).slice(0, 8) : '—'}
                  </td>
                  <td className="td-muted text-sm">{fmtCurrency(quote.total_amount)}</td>
                  <td>
                    <Badge color={STATUS_COLORS[quote.status] || 'gray'}>
                      {quote.status || '—'}
                    </Badge>
                  </td>
                  <td className="td-muted text-sm">
                    {quote.valid_until ? toDateInput(quote.valid_until) : '—'}
                  </td>
                  <td className="td-muted text-sm">{fmtDate(quote.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={modalMode === 'create'}
        onClose={closeModal}
        title="New Quote"
      >
        <form onSubmit={handleCreateSubmit}>
          <div className="form-group">
            <label className="form-label">Title</label>
            <input
              className="form-input"
              name="title"
              value={createForm.title}
              onChange={handleCreateChange}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Lead ID</label>
            <input
              className="form-input"
              name="lead_id"
              value={createForm.lead_id}
              onChange={handleCreateChange}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Total Amount</label>
            <input
              className="form-input"
              type="number"
              name="total_amount"
              value={createForm.total_amount}
              onChange={handleCreateChange}
              min={0}
              step="0.01"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Currency</label>
            <input
              className="form-input"
              name="currency"
              value={createForm.currency}
              onChange={handleCreateChange}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Valid Until</label>
            <input
              className="form-input"
              type="date"
              name="valid_until"
              value={createForm.valid_until}
              onChange={handleCreateChange}
            />
          </div>
          <div className="flex gap-2 items-center">
            <button
              className="btn btn-primary"
              type="submit"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating…' : 'Create'}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={closeModal}
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={modalMode === 'edit'}
        onClose={closeModal}
        title="Edit Quote"
      >
        <form onSubmit={handleEditSubmit}>
          <div className="form-group">
            <label className="form-label">Title</label>
            <input
              className="form-input"
              name="title"
              value={editForm.title}
              onChange={handleEditChange}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select
              className="form-input"
              name="status"
              value={editForm.status}
              onChange={handleEditChange}
            >
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
              <option value="expired">Expired</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Valid Until</label>
            <input
              className="form-input"
              type="date"
              name="valid_until"
              value={editForm.valid_until}
              onChange={handleEditChange}
            />
          </div>
          <div className="flex gap-2 items-center">
            <button
              className="btn btn-primary"
              type="submit"
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
            </button>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => deleteMutation.mutate(editing.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={closeModal}
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
