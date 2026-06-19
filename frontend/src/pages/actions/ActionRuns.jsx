import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Zap } from 'lucide-react'
import { get } from '../../api'
import Spinner from '../../components/Spinner'
import Badge from '../../components/Badge'
import EmptyState from '../../components/EmptyState'

const STATUSES = ['', 'pending', 'running', 'completed', 'failed', 'cancelled', 'waiting_approval']

function fmtDate(d) { return d ? new Date(d).toLocaleString() : '—' }

export default function ActionRuns() {
  const [status, setStatus] = useState('')

  const { data: runs = [], isLoading } = useQuery({
    queryKey: ['action-runs', status],
    queryFn: () => get('/action-runs', { ...(status ? { status } : {}), limit: 100 }),
  })

  if (isLoading) return <Spinner />

  return (
    <div>
      <div className="page-header">
        <div><h1>Action Runs</h1><p>Ledger of all executed and queued actions</p></div>
        <select className="form-input" value={status} onChange={e => setStatus(e.target.value)} style={{ width: 180 }}>
          <option value="">All statuses</option>
          {STATUSES.filter(Boolean).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {runs.length === 0
        ? <EmptyState icon={Zap} title="No action runs" description="Actions are executed via the Messenger AI or API." />
        : (
          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Action</th><th>Status</th><th>Approval</th><th>Requested By</th><th>Started</th><th>Completed</th></tr></thead>
                <tbody>
                  {runs.map(r => (
                    <tr key={r.id}>
                      <td><span className="td-title font-medium">{r.action_key}</span><div className="td-muted">{r.id.slice(0, 8)}</div></td>
                      <td><Badge label={r.status} /></td>
                      <td>{r.approval_status ? <Badge label={r.approval_status} /> : <span className="td-muted">—</span>}</td>
                      <td className="td-muted">{r.requested_by_id?.slice(0, 8) || '—'}</td>
                      <td className="td-muted">{fmtDate(r.started_at || r.created_at)}</td>
                      <td className="td-muted">{fmtDate(r.completed_at)}</td>
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
