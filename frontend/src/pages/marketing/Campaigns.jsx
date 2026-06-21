import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Megaphone } from 'lucide-react'
import { get, post, patch, del } from '../../api'
import Spinner from '../../components/Spinner'
import Badge from '../../components/Badge'
import EmptyState from '../../components/EmptyState'
import Modal from '../../components/Modal'

const TYPES = ['email', 'sms', 'social', 'event']
const STATUSES = ['draft', 'active', 'paused', 'completed']

const BLANK = { name: '', type: 'email', status: 'draft' }

export default function Campaigns() {
  const qc = useQueryClient()
  const [filterStatus, setFilterStatus] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(BLANK)

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['campaigns', filterStatus],
    queryFn: () => get('/campaigns', { limit: 100, ...(filterStatus ? { status: filterStatus } : {}) }),
  })

  const createMut = useMutation({
    mutationFn: body => post('/campaigns', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['campaigns'] }); closeModal() },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, body }) => patch(`/campaigns/${id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['campaigns'] }); closeModal() },
  })

  const deleteMut = useMutation({
    mutationFn: id => del(`/campaigns/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['campaigns'] }); closeModal() },
  })

  function openCreate() {
    setEditing(null)
    setForm(BLANK)
    setShowModal(true)
  }

  function openEdit(c) {
    setEditing(c)
    setForm({ name: c.name, type: c.type, status: c.status })
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditing(null)
    setForm(BLANK)
  }

  function handleSave() {
    if (editing) {
      updateMut.mutate({ id: editing.id, body: form })
    } else {
      createMut.mutate(form)
    }
  }

  const isBusy = createMut.isPending || updateMut.isPending
  const mutError = createMut.error || updateMut.error

  if (isLoading) return <Spinner />

  const visible = filterStatus
    ? campaigns.filter(c => c.status === filterStatus)
    : campaigns

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Campaigns</h1>
          <p>{visible.length} campaign{visible.length !== 1 ? 's' : ''}</p>
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
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={15} /> New Campaign
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No campaigns yet"
          description="Create your first campaign to start reaching your audience."
          action={<button className="btn btn-primary" onClick={openCreate}>New Campaign</button>}
        />
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visible.map(c => (
                  <tr key={c.id}>
                    <td className="font-medium">{c.name}</td>
                    <td className="td-muted">{c.type}</td>
                    <td><Badge label={c.status} /></td>
                    <td className="td-muted text-sm">{new Date(c.created_at).toLocaleDateString()}</td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(c)}>Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={showModal}
        onClose={closeModal}
        title={editing ? 'Edit Campaign' : 'New Campaign'}
        footer={
          <div className="flex gap-2 items-center" style={{ justifyContent: 'space-between', width: '100%' }}>
            <div>
              {editing && (
                <button
                  className="btn btn-danger btn-sm"
                  disabled={deleteMut.isPending}
                  onClick={() => { if (window.confirm('Delete this campaign?')) deleteMut.mutate(editing.id) }}
                >
                  {deleteMut.isPending ? 'Deleting…' : 'Delete'}
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button className="btn btn-secondary btn-sm" onClick={closeModal}>Cancel</button>
              <button className="btn btn-primary" disabled={isBusy || !form.name.trim()} onClick={handleSave}>
                {isBusy ? 'Saving…' : editing ? 'Save' : 'Create'}
              </button>
            </div>
          </div>
        }
      >
        <div className="form-group">
          <label className="form-label">Name *</label>
          <input
            className="form-input"
            autoFocus
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Campaign name"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Type</label>
          <select className="form-input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Status</label>
          <select className="form-input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {mutError && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{mutError.message}</p>}
      </Modal>
    </div>
  )
}
