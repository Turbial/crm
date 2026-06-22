import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ShieldCheck } from 'lucide-react'
import { get } from '../api'
import Spinner from '../components/Spinner'
import Badge from '../components/Badge'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'

const fmtDate = d => d ? new Date(d).toLocaleString() : '—'

const ACTION_TYPES = ['', 'create', 'update', 'delete', 'login']

const actionColor = {
  create: 'green',
  update: 'blue',
  delete: 'red',
  login: 'purple',
}

function changesCount(changes) {
  if (!changes) return '—'
  if (typeof changes === 'object' && !Array.isArray(changes)) {
    const keys = Object.keys(changes)
    return keys.length > 0 ? `${keys.length} field${keys.length !== 1 ? 's' : ''}` : '—'
  }
  if (Array.isArray(changes)) {
    return changes.length > 0 ? `${changes.length} change${changes.length !== 1 ? 's' : ''}` : '—'
  }
  return '—'
}

const LIMIT = 100

export default function AuditLog() {
  const [actionFilter, setActionFilter] = useState('')
  const [offset, setOffset] = useState(0)
  const [selected, setSelected] = useState(null)

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-log', actionFilter, offset],
    queryFn: () => get('/audit-log', { limit: LIMIT, offset }),
  })

  const filtered = actionFilter
    ? logs.filter(l => l.action === actionFilter)
    : logs

  if (isLoading) return <Spinner />

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Audit Log</h1>
          <p>{filtered.length} entries</p>
        </div>
        <div className="flex gap-2 items-center">
          <select
            className="form-input"
            style={{ width: 160 }}
            value={actionFilter}
            onChange={e => { setActionFilter(e.target.value); setOffset(0) }}
          >
            <option value="">All actions</option>
            {ACTION_TYPES.filter(Boolean).map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0
        ? (
          <EmptyState
            icon={ShieldCheck}
            title="No audit log entries"
            description="Actions performed by users will appear here."
          />
        )
        : (
          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Action</th>
                    <th>Entity</th>
                    <th>Changes</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(log => (
                    <tr
                      key={log.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSelected(log)}
                    >
                      <td>
                        <div className="font-medium text-sm">{log.user_name || '—'}</div>
                        {log.user_id && (
                          <div className="td-muted text-xs" style={{ fontFamily: 'monospace' }}>
                            {String(log.user_id).slice(0, 8)}
                          </div>
                        )}
                      </td>
                      <td>
                        <Badge label={log.action} color={actionColor[log.action] || 'gray'} />
                      </td>
                      <td>
                        {log.entity_type
                          ? (
                            <span
                              style={{
                                fontSize: 11,
                                padding: '2px 8px',
                                borderRadius: 10,
                                background: 'var(--bg-muted)',
                                color: 'var(--text-muted)',
                                fontFamily: 'monospace',
                              }}
                            >
                              {log.entity_type}/{String(log.entity_id || '').slice(0, 8)}
                            </span>
                          )
                          : <span className="td-muted">—</span>}
                      </td>
                      <td className="td-muted text-sm">{changesCount(log.changes)}</td>
                      <td className="td-muted text-sm">{fmtDate(log.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Audit Entry Detail"
        footer={
          <button className="btn btn-secondary btn-sm" onClick={() => setSelected(null)}>Close</button>
        }
      >
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div className="text-xs td-muted" style={{ marginBottom: 4 }}>User</div>
                <div className="font-medium text-sm">{selected.user_name || '—'}</div>
                {selected.user_id && (
                  <div className="text-xs td-muted" style={{ fontFamily: 'monospace', marginTop: 2 }}>
                    {selected.user_id}
                  </div>
                )}
              </div>
              <div>
                <div className="text-xs td-muted" style={{ marginBottom: 4 }}>Action</div>
                <Badge label={selected.action} color={actionColor[selected.action] || 'gray'} />
              </div>
              <div>
                <div className="text-xs td-muted" style={{ marginBottom: 4 }}>Entity</div>
                <div className="text-sm font-medium">{selected.entity_type || '—'}</div>
                {selected.entity_id && (
                  <div className="text-xs td-muted" style={{ fontFamily: 'monospace', marginTop: 2 }}>
                    {selected.entity_id}
                  </div>
                )}
              </div>
              <div>
                <div className="text-xs td-muted" style={{ marginBottom: 4 }}>Date</div>
                <div className="text-sm">{fmtDate(selected.created_at)}</div>
              </div>
            </div>

            <div>
              <div className="text-xs td-muted" style={{ marginBottom: 6 }}>Changes</div>
              <pre style={{
                background: 'var(--bg-muted)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: 12,
                fontSize: 12,
                overflowX: 'auto',
                margin: 0,
                maxHeight: 320,
                overflowY: 'auto',
                color: 'var(--text)',
              }}>
                {selected.changes != null
                  ? JSON.stringify(selected.changes, null, 2)
                  : 'null'}
              </pre>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
