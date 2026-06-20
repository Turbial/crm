import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckSquare, Check, X } from 'lucide-react'
import { get, post } from '../../api'
import Spinner from '../../components/Spinner'
import Badge from '../../components/Badge'
import EmptyState from '../../components/EmptyState'
import Modal from '../../components/Modal'

function fmtDate(d) { return d ? new Date(d).toLocaleString() : '—' }

export default function Approvals() {
  const qc = useQueryClient()
  const [decision, setDecision] = useState(null) // { id, action: 'approve'|'reject' }
  const [note, setNote] = useState('')

  const { data: approvals = [], isLoading } = useQuery({
    queryKey: ['approvals'],
    queryFn: () => get('/approvals', { limit: 100 }),
  })

  const decide = useMutation({
    mutationFn: ({ id, action, note }) => post(`/approvals/${id}/${action}`, note ? { note } : undefined),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['approvals'] }); setDecision(null); setNote('') },
  })

  if (isLoading) return <Spinner />

  const pending = approvals.filter(a => a.status === 'pending')
  const resolved = approvals.filter(a => a.status !== 'pending')

  return (
    <div>
      <div className="page-header">
        <div><h1>Approvals</h1><p>{pending.length} pending · {resolved.length} resolved</p></div>
      </div>

      {pending.length === 0 && resolved.length === 0
        ? <EmptyState icon={CheckSquare} title="No approvals" description="Approval requests appear here when actions require human sign-off." />
        : (
          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Request</th><th>Risk</th><th>Status</th><th>Due</th><th>Created</th><th>Actions</th></tr></thead>
                <tbody>
                  {[...pending, ...resolved].map(a => (
                    <tr key={a.id}>
                      <td>
                        <div className="font-medium text-sm">{a.title || `Action #${a.action_run_id?.slice(0, 8)}`}</div>
                        <div className="td-muted">{a.id.slice(0, 8)}</div>
                      </td>
                      <td><Badge label={a.risk_level || 'medium'} /></td>
                      <td><Badge label={a.status} /></td>
                      <td className="td-muted">{fmtDate(a.due_at || a.expires_at)}</td>
                      <td className="td-muted">{fmtDate(a.created_at)}</td>
                      <td>
                        {a.status === 'pending' && (
                          <div className="flex gap-2">
                            <button className="btn btn-accent btn-sm" onClick={() => { setDecision({ id: a.id, action: 'approve' }); setNote('') }}>
                              <Check size={13} /> Approve
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={() => { setDecision({ id: a.id, action: 'reject' }); setNote('') }}>
                              <X size={13} /> Reject
                            </button>
                          </div>
                        )}
                        {a.note && <div className="text-xs td-muted mt-1">"{a.note}"</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      <Modal
        open={!!decision}
        onClose={() => setDecision(null)}
        title={decision?.action === 'approve' ? 'Approve Request' : 'Reject Request'}
        footer={<>
          <button className="btn btn-secondary" onClick={() => setDecision(null)}>Cancel</button>
          <button
            className={`btn ${decision?.action === 'approve' ? 'btn-accent' : 'btn-danger'}`}
            disabled={decide.isPending}
            onClick={() => decide.mutate({ id: decision.id, action: decision.action, note })}
          >
            {decide.isPending ? 'Saving…' : decision?.action === 'approve' ? 'Confirm Approve' : 'Confirm Reject'}
          </button>
        </>}
      >
        <div className="form-group">
          <label className="form-label">Note <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
          <textarea
            className="form-input"
            rows={3}
            placeholder={decision?.action === 'reject' ? 'Reason for rejection…' : 'Any notes for the record…'}
            value={note}
            onChange={e => setNote(e.target.value)}
            style={{ resize: 'vertical' }}
          />
        </div>
        {decide.isError && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{decide.error?.message}</p>}
      </Modal>
    </div>
  )
}
