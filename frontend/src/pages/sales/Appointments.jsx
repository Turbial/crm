import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { get, post, patch, del } from '../../api'
import Spinner from '../../components/Spinner'
import Badge from '../../components/Badge'
import EmptyState from '../../components/EmptyState'
import Modal from '../../components/Modal'

const fmtDate = (d) => d ? new Date(d).toLocaleString() : '—'

const STATUS_COLORS = {
  scheduled: 'blue',
  completed: 'green',
  cancelled: 'gray',
  no_show: 'red',
}

const EMPTY_FORM = {
  title: '',
  scheduled_at: '',
  duration_minutes: '',
  contact_id: '',
  lead_id: '',
  notes: '',
}

function toDatetimeLocal(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function Appointments() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['appointments'],
    queryFn: () => get('/appointments?limit=100'),
  })

  const createMutation = useMutation({
    mutationFn: (body) => post('/appointments', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['appointments'] }); closeModal() },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }) => patch(`/appointments/${id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['appointments'] }); closeModal() },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => del(`/appointments/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['appointments'] }); closeModal() },
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  function openEdit(appt) {
    setEditing(appt)
    setForm({
      title: appt.title || '',
      scheduled_at: toDatetimeLocal(appt.scheduled_at),
      duration_minutes: appt.duration_minutes ?? '',
      contact_id: appt.contact_id || '',
      lead_id: appt.lead_id || '',
      notes: appt.notes || '',
    })
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditing(null)
    setForm(EMPTY_FORM)
  }

  function handleChange(e) {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    const body = {
      title: form.title,
      scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : undefined,
      duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : undefined,
      contact_id: form.contact_id || undefined,
      lead_id: form.lead_id || undefined,
      notes: form.notes || undefined,
    }
    if (editing) {
      updateMutation.mutate({ id: editing.id, body })
    } else {
      createMutation.mutate(body)
    }
  }

  const filtered = statusFilter
    ? appointments.filter((a) => a.status === statusFilter)
    : appointments

  const isPending = createMutation.isPending || updateMutation.isPending

  function linkedTo(appt) {
    if (appt.lead_id) return `Lead: ${String(appt.lead_id).slice(0, 8)}`
    if (appt.contact_id) return `Contact: ${String(appt.contact_id).slice(0, 8)}`
    return '—'
  }

  return (
    <div>
      <div className="page-header">
        <h1>Appointments</h1>
        <div className="flex gap-2 items-center">
          <select
            className="form-input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no_show">No Show</option>
          </select>
          <button className="btn btn-primary" onClick={openCreate}>
            New Appointment
          </button>
        </div>
      </div>

      {isLoading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <EmptyState message="No appointments found." />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Linked To</th>
                <th>Scheduled At</th>
                <th>Duration</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((appt) => (
                <tr
                  key={appt.id}
                  onClick={() => openEdit(appt)}
                  style={{ cursor: 'pointer' }}
                >
                  <td className="font-medium">{appt.title}</td>
                  <td className="td-muted text-sm">{linkedTo(appt)}</td>
                  <td className="td-muted text-sm">{fmtDate(appt.scheduled_at)}</td>
                  <td className="td-muted text-sm">
                    {appt.duration_minutes != null ? `${appt.duration_minutes} min` : '—'}
                  </td>
                  <td>
                    <Badge color={STATUS_COLORS[appt.status] || 'gray'}>
                      {appt.status || '—'}
                    </Badge>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-2 items-center">
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => openEdit(appt)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => deleteMutation.mutate(appt.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? 'Edit Appointment' : 'New Appointment'}
      >
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Title</label>
            <input
              className="form-input"
              name="title"
              value={form.title}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Scheduled At</label>
            <input
              className="form-input"
              type="datetime-local"
              name="scheduled_at"
              value={form.scheduled_at}
              onChange={handleChange}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Duration (minutes)</label>
            <input
              className="form-input"
              type="number"
              name="duration_minutes"
              value={form.duration_minutes}
              onChange={handleChange}
              min={0}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Contact ID</label>
            <input
              className="form-input"
              name="contact_id"
              value={form.contact_id}
              onChange={handleChange}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Lead ID</label>
            <input
              className="form-input"
              name="lead_id"
              value={form.lead_id}
              onChange={handleChange}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea
              className="form-input"
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows={3}
            />
          </div>
          <div className="flex gap-2 items-center">
            <button className="btn btn-primary" type="submit" disabled={isPending}>
              {isPending ? 'Saving…' : editing ? 'Save Changes' : 'Create'}
            </button>
            {editing && (
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => deleteMutation.mutate(editing.id)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
            )}
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
