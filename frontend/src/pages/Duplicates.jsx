import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Copy } from 'lucide-react'
import { get, post } from '../api'
import Spinner from '../components/Spinner'
import Badge from '../components/Badge'
import EmptyState from '../components/EmptyState'

const MERGE_ENDPOINTS = {
  lead: 'merge-leads',
  contact: 'merge-contacts',
  company: 'merge-companies',
}

export default function Duplicates() {
  const qc = useQueryClient()
  const [entityType, setEntityType] = useState('')

  const { data: candidates = [], isLoading } = useQuery({
    queryKey: ['duplicates', entityType],
    queryFn: () => get('/duplicates', { status: 'pending', ...(entityType ? { entity_type: entityType } : {}) }),
  })

  const dismiss = useMutation({
    mutationFn: id => post(`/duplicates/${id}/dismiss`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['duplicates'] }),
  })

  const merge = useMutation({
    mutationFn: ({ keepId, mergeId, entityType }) => {
      const endpoint = MERGE_ENDPOINTS[entityType]
      return post(`/duplicates/${endpoint}?keep_id=${encodeURIComponent(keepId)}&merge_id=${encodeURIComponent(mergeId)}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['duplicates'] }),
  })

  if (isLoading) return <Spinner />

  return (
    <div>
      <div className="page-header">
        <div><h1>Duplicates</h1><p>{candidates.length} pending candidates</p></div>
        <select className="form-input" value={entityType} onChange={e => setEntityType(e.target.value)} style={{ width: 160 }}>
          <option value="">All types</option>
          <option value="lead">Leads</option>
          <option value="contact">Contacts</option>
          <option value="company">Companies</option>
        </select>
      </div>

      {candidates.length === 0
        ? <EmptyState icon={Copy} title="No duplicate candidates" description="The duplicate scanner runs automatically and surfaces matches here." />
        : (
          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Type</th><th>Entity A</th><th>Entity B</th><th>Score</th><th>Matched Fields</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {candidates.map(c => (
                    <tr key={c.id}>
                      <td><Badge label={c.entity_type} color="purple" /></td>
                      <td><code style={{ background: 'var(--bg)', borderRadius: 4, padding: '2px 6px', fontSize: 12 }}>{c.entity_id_a.slice(0, 12)}</code></td>
                      <td><code style={{ background: 'var(--bg)', borderRadius: 4, padding: '2px 6px', fontSize: 12 }}>{c.entity_id_b.slice(0, 12)}</code></td>
                      <td>
                        <span className="font-semibold" style={{ color: c.score >= 0.95 ? 'var(--danger)' : 'var(--warning)' }}>
                          {(c.score * 100).toFixed(0)}%
                        </span>
                      </td>
                      <td className="td-muted">{(c.matched_fields || []).join(', ')}</td>
                      <td>
                        <div className="flex gap-2">
                          <button className="btn btn-secondary btn-sm" onClick={() => dismiss.mutate(c.id)} disabled={dismiss.isPending}>
                            Dismiss
                          </button>
                          {MERGE_ENDPOINTS[c.entity_type] && (
                            <button className="btn btn-danger btn-sm" disabled={merge.isPending}
                              onClick={() => { if (window.confirm(`Merge ${c.entity_id_b.slice(0, 8)} into ${c.entity_id_a.slice(0, 8)}?`)) merge.mutate({ keepId: c.entity_id_a, mergeId: c.entity_id_b, entityType: c.entity_type }) }}>
                              Merge →A
                            </button>
                          )}
                        </div>
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
