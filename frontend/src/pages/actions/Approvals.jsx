import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckSquare, Check, X } from 'lucide-react'
import { get, post } from '../../api'
import Spinner from '../../components/Spinner'
import Badge from '../../components/Badge'
import EmptyState from '../../components/EmptyState'

function fmtDate(d) { return d ? new Date(d).toLocaleString() : '—' }

export default function Approvals() {
  const qc = useQueryClient()

  const { data: approvals = [], isLoading } = useQuery({
    queryKey: ['approvals'],
    queryFn: () => get('/approvals?limit=100'),
  })

  const approve = useMutation({
    mutationFn: id => post(`/approvals/${id}/approve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['approvals'] }),
  })

  const reject = useMutation({
    mutationFn: id => post(`/approvals/${id}/reject`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['approvals'] }),
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
                <thead><tr><th>Action Run</th><th>Status</th><th>Due</th><th>Created</th><th>Actions</th></tr></thead>
                <tbody>
                  {[...pending, ...resolved].map(a => (
                    <tr key={a.id}>
                      <td><span className="font-medium">{a.action_run_id?.slice(0, 10)}</span><div className="td-muted">{a.id.slice(0, 8)}</div></td>
                      <td><Badge label={a.status} /></td>
                      <td className="td-muted">{fmtDate(a.due_at || a.expires_at)}</td>
                      <td className="td-muted">{fmtDate(a.created_at)}</td>
                      <td>
                        {a.status === 'pending' && (
                          <div className="flex gap-2">
                            <button className="btn btn-accent btn-sm" onClick={() => approve.mutate(a.id)} disabled={approve.isPending}>
                              <Check size={13} /> Approve
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={() => reject.mutate(a.id)} disabled={reject.isPending}>
                              <X size={13} /> Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
    </div>
  )
}
