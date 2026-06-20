import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Zap, X, XCircle } from 'lucide-react'
import { get, post } from '../../api'
import Spinner from '../../components/Spinner'
import Badge from '../../components/Badge'
import EmptyState from '../../components/EmptyState'

const STATUSES = ['', 'pending', 'running', 'completed', 'failed', 'cancelled', 'waiting_approval']
const CANCELLABLE = new Set(['pending', 'running', 'waiting_approval'])
const STATUS_BADGE = {
  pending: 'yellow', running: 'blue', completed: 'green',
  failed: 'red', cancelled: 'gray', waiting_approval: 'purple',
}

function fmtDate(d) { return d ? new Date(d).toLocaleString() : '—' }

function JsonBlock({ data }) {
  if (!data || Object.keys(data).length === 0) return <span style={{ color: 'var(--text-xs)', fontSize: 12 }}>—</span>
  return (
    <pre style={{
      background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 6,
      padding: '8px 10px', fontSize: 11, overflowX: 'auto', maxHeight: 160,
      margin: 0, lineHeight: 1.5, color: 'var(--text)',
    }}>
      {JSON.stringify(data, null, 2)}
    </pre>
  )
}

function RunDetail({ runId, onClose }) {
  const qc = useQueryClient()

  const { data: run, isLoading } = useQuery({
    queryKey: ['action-run', runId],
    queryFn: () => get(`/action-runs/${runId}`),
    refetchInterval: run?.status && CANCELLABLE.has(run.status) ? 3000 : false,
  })

  const cancel = useMutation({
    mutationFn: () => post(`/action-runs/${runId}/cancel`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['action-run', runId] })
      qc.invalidateQueries({ queryKey: ['action-runs'] })
    },
  })

  return (
    <div
      style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 460,
        background: 'var(--surface)', borderLeft: '1px solid var(--border)',
        boxShadow: '-4px 0 24px rgba(0,0,0,.1)', zIndex: 200,
        display: 'flex', flexDirection: 'column',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <Zap size={16} color="var(--accent)" />
        <span style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>Action Run</span>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={15} /></button>
      </div>

      {isLoading ? (
        <div style={{ padding: 24 }}><Spinner /></div>
      ) : run ? (
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Badge label={run.status} color={STATUS_BADGE[run.status] || 'gray'} />
            {CANCELLABLE.has(run.status) && (
              <button
                className="btn btn-danger btn-sm"
                disabled={cancel.isPending}
                onClick={() => cancel.mutate()}
                style={{ fontSize: 12 }}
              >
                <XCircle size={13} /> Cancel
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Row label="Action" value={<code style={{ fontSize: 12 }}>{run.action_key}</code>} />
            <Row label="Run ID" value={<code style={{ fontSize: 11, color: 'var(--text-muted)' }}>{run.id}</code>} />
            <Row label="Source" value={run.source || '—'} />
            <Row label="Requested by" value={run.requested_by_id ? run.requested_by_id.slice(0, 8) + '…' : '—'} />
            <Row label="Entity" value={run.linked_entity_type ? `${run.linked_entity_type} / ${run.linked_entity_id?.slice(0, 8)}` : '—'} />
            <Row label="Started" value={fmtDate(run.started_at || run.created_at)} />
            <Row label="Completed" value={fmtDate(run.completed_at)} />
          </div>

          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Input</p>
            <JsonBlock data={run.input_payload} />
          </div>

          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Output</p>
            <JsonBlock data={run.output_payload} />
          </div>

          {run.error && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Error</p>
              <pre style={{ background: 'var(--danger-soft)', border: '1px solid #fca5a5', borderRadius: 6, padding: '8px 10px', fontSize: 11, color: 'var(--danger)', whiteSpace: 'pre-wrap', margin: 0 }}>
                {run.error}
              </pre>
            </div>
          )}

          {run.logs && run.logs.length > 0 && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Logs</p>
              <pre style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', fontSize: 11, overflowX: 'auto', maxHeight: 200, margin: 0 }}>
                {Array.isArray(run.logs) ? run.logs.join('\n') : String(run.logs)}
              </pre>
            </div>
          )}
        </div>
      ) : (
        <p style={{ padding: 24, color: 'var(--text-muted)' }}>Run not found.</p>
      )}
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 100, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13 }}>{value}</span>
    </div>
  )
}

export default function ActionRuns() {
  const [status, setStatus] = useState('')
  const [selectedId, setSelectedId] = useState(null)

  const { data: runs = [], isLoading } = useQuery({
    queryKey: ['action-runs', status],
    queryFn: () => get('/action-runs', { ...(status ? { status } : {}), limit: 100 }),
    refetchInterval: 10000,
  })

  if (isLoading) return <Spinner />

  return (
    <div>
      <div className="page-header">
        <div><h1>Action Runs</h1><p>Ledger of all executed and queued actions</p></div>
        <select
          className="form-input"
          value={status}
          onChange={e => setStatus(e.target.value)}
          style={{ width: 180 }}
        >
          <option value="">All statuses</option>
          {STATUSES.filter(Boolean).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {runs.length === 0 ? (
        <EmptyState icon={Zap} title="No action runs" description="Actions are executed via the Messenger AI, API, or automation triggers." />
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Status</th>
                  <th>Entity</th>
                  <th>Started</th>
                  <th>Completed</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {runs.map(r => (
                  <tr
                    key={r.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedId(r.id)}
                  >
                    <td>
                      <span className="td-title font-medium">{r.action_key}</span>
                      <div className="td-muted">{r.id.slice(0, 8)}</div>
                    </td>
                    <td><Badge label={r.status} color={STATUS_BADGE[r.status] || 'gray'} /></td>
                    <td className="td-muted">
                      {r.linked_entity_type ? `${r.linked_entity_type}` : '—'}
                    </td>
                    <td className="td-muted">{fmtDate(r.started_at || r.created_at)}</td>
                    <td className="td-muted">{fmtDate(r.completed_at)}</td>
                    <td>
                      {CANCELLABLE.has(r.status) && (
                        <span style={{ fontSize: 11, color: 'var(--text-xs)' }}>cancellable</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedId && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 199, background: 'rgba(0,0,0,.12)' }}
            onClick={() => setSelectedId(null)}
          />
          <RunDetail runId={selectedId} onClose={() => setSelectedId(null)} />
        </>
      )}
    </div>
  )
}
