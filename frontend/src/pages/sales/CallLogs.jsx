import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { get, post } from '../../api'
import Spinner from '../../components/Spinner'
import Badge from '../../components/Badge'
import EmptyState from '../../components/EmptyState'
import Modal from '../../components/Modal'

const fmtDate = (d) => d ? new Date(d).toLocaleString() : '—'

function fmtDuration(seconds) {
  if (seconds == null) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

const DIRECTION_COLORS = { inbound: 'green', outbound: 'blue' }
const STATUS_COLORS = {
  answered: 'green',
  no_answer: 'gray',
  busy: 'yellow',
  failed: 'red',
}

const EMPTY_FORM = {
  contact_id: '',
  lead_id: '',
  direction: 'inbound',
  duration_seconds: '',
  status: 'answered',
  outcome: '',
  notes: '',
}

export default function CallLogs() {
  const qc = useQueryClient()
  const [directionFilter, setDirectionFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['call-logs'],
    queryFn: () => get('/call-logs?limit=100'),
  })

  const createMutation = useMutation({
    mutationFn: (body) => post('/call-logs', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['call-logs'] }); closeModal() },
  })

  function openModal() {
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setForm(EMPTY_FORM)
  }

  function handleChange(e) {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    const body = {
      contact_id: form.contact_id || undefined,
      lead_id: form.lead_id || undefined,
      direction: form.direction,
      duration_seconds: form.duration_seconds !== '' ? Number(form.duration_seconds) : undefined,
      status: form.status,
      outcome: form.outcome || undefined,
      notes: form.notes || undefined,
    }
    createMutation.mutate(body)
  }

  function linkedTo(log) {
    if (log.lead_id) return `Lead: ${String(log.lead_id).slice(0, 8)}`
    if (log.contact_id) return `Contact: ${String(log.contact_id).slice(0, 8)}`
    return '—'
  }

  let filtered = logs
  if (directionFilter) filtered = filtered.filter((l) => l.direction === directionFilter)
  if (statusFilter) filtered = filtered.filter((l) => l.status === statusFilter)

  return (
    <div>
      <div className="page-header">
        <h1>Call Logs</h1>
        <div className="flex gap-2 items-center">
          <select
            className="form-input"
            value={directionFilter}
            onChange={(e) => setDirectionFilter(e.target.value)}
          >
            <option value="">All Directions</option>
            <option value="inbound">Inbound</option>
            <option value="outbound">Outbound</option>
          </select>
          <select
            className="form-input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="answered">Answered</option>
            <option value="no_answer">No Answer</option>
            <option value="busy">Busy</option>
            <option value="failed">Failed</option>
          </select>
          <button className="btn btn-primary" onClick={openModal}>
            Log Call
          </button>
        </div>
      </div>

      {isLoading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <EmptyState message="No call logs found." />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Direction</th>
                <th>Linked To</th>
                <th>Duration</th>
                <th>Status</th>
                <th>Outcome</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((log) => (
                <tr key={log.id}>
                  <td>
                    <Badge color={DIRECTION_COLORS[log.direction] || 'gray'}>
                      {log.direction || '—'}
                    </Badge>
                  </td>
                  <td className="td-muted text-sm">{linkedTo(log)}</td>
                  <td className="td-muted text-sm">{fmtDuration(log.duration_seconds)}</td>
                  <td>
                    <Badge color={STATUS_COLORS[log.status] || 'gray'}>
                      {log.status || '—'}
                    </Badge>
                  </td>
                  <td className="td-muted text-sm">
                    {log.outcome
                      ? log.outcome.length > 50
                        ? log.outcome.slice(0, 50) + '…'
                        : log.outcome
                      : '—'}
                  </td>
                  <td className="td-muted text-sm">{fmtDate(log.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={closeModal} title="Log Call">
        <form onSubmit={handleSubmit}>
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
            <label className="form-label">Direction</label>
            <select
              className="form-input"
              name="direction"
              value={form.direction}
              onChange={handleChange}
            >
              <option value="inbound">Inbound</option>
              <option value="outbound">Outbound</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Duration (seconds)</label>
            <input
              className="form-input"
              type="number"
              name="duration_seconds"
              value={form.duration_seconds}
              onChange={handleChange}
              min={0}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select
              className="form-input"
              name="status"
              value={form.status}
              onChange={handleChange}
            >
              <option value="answered">Answered</option>
              <option value="no_answer">No Answer</option>
              <option value="busy">Busy</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Outcome</label>
            <input
              className="form-input"
              name="outcome"
              value={form.outcome}
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
            <button
              className="btn btn-primary"
              type="submit"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Saving…' : 'Log Call'}
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
