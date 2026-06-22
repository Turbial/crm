import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, PenLine } from 'lucide-react'
import { get, post } from '../../api'
import Spinner from '../../components/Spinner'
import EmptyState from '../../components/EmptyState'
import Modal from '../../components/Modal'

const fmtDate = d => d ? new Date(d).toLocaleString() : '—'

const EMPTY_FORM = { lead_id: '', body: '' }

export default function Notes() {
  const qc = useQueryClient()
  const [leadFilter, setLeadFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['notes'],
    queryFn: () => get('/notes', { limit: 200 }),
  })

  const create = useMutation({
    mutationFn: body => post('/notes', {
      lead_id: body.lead_id || undefined,
      body: body.body,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notes'] }); setShowCreate(false); setForm(EMPTY_FORM) },
  })

  const filtered = notes.filter(n =>
    !leadFilter || String(n.lead_id || '').toLowerCase().includes(leadFilter.toLowerCase())
  )

  if (isLoading) return <Spinner />

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Notes</h1>
          <p>{filtered.length} {filtered.length === 1 ? 'note' : 'notes'}</p>
        </div>
        <div className="flex gap-2 items-center">
          <input
            className="form-input"
            value={leadFilter}
            onChange={e => setLeadFilter(e.target.value)}
            placeholder="Filter by Lead ID…"
            style={{ width: 200 }}
          />
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}><Plus size={15} /> Add Note</button>
        </div>
      </div>

      {filtered.length === 0
        ? <EmptyState icon={PenLine} title="No notes yet" description="Capture important context by adding your first note." action={<button className="btn btn-primary" onClick={() => setShowCreate(true)}>Add note</button>} />
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map(n => (
              <div
                key={n.id}
                className="card"
                style={{ cursor: 'pointer', padding: '16px 20px' }}
                onClick={() => setSelected(n)}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {n.lead_id && (
                      <span style={{
                        display: 'inline-block',
                        fontFamily: 'monospace',
                        fontSize: 11,
                        background: 'var(--bg-subtle)',
                        border: '1px solid var(--border)',
                        borderRadius: 4,
                        padding: '1px 6px',
                        marginBottom: 8,
                        color: 'var(--text-muted)',
                      }}>
                        {String(n.lead_id).slice(0, 8)}
                      </span>
                    )}
                    <p style={{ margin: 0, fontSize: 14, color: 'var(--text)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {n.body}
                    </p>
                  </div>
                  <span className="td-muted" style={{ fontSize: 12, whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {fmtDate(n.created_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

      <Modal open={showCreate} onClose={() => { setShowCreate(false); setForm(EMPTY_FORM) }} title="Add Note"
        footer={<>
          <button className="btn btn-secondary" onClick={() => { setShowCreate(false); setForm(EMPTY_FORM) }}>Cancel</button>
          <button className="btn btn-primary" disabled={create.isPending || !form.body.trim()} onClick={() => create.mutate(form)}>
            {create.isPending ? 'Saving…' : 'Save'}
          </button>
        </>}>
        <div className="form-group">
          <label className="form-label">Lead ID</label>
          <input className="form-input" value={form.lead_id} onChange={e => setForm(f => ({ ...f, lead_id: e.target.value }))} placeholder="Lead ID (optional)" />
        </div>
        <div className="form-group">
          <label className="form-label">Body</label>
          <textarea className="form-input" rows={6} value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} placeholder="Write your note…" autoFocus />
        </div>
        {create.isError && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{create.error.message}</p>}
      </Modal>

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Note"
        footer={<button className="btn btn-secondary" onClick={() => setSelected(null)}>Close</button>}>
        {selected && (
          <>
            {selected.lead_id && (
              <div className="form-group">
                <label className="form-label">Lead ID</label>
                <span style={{
                  display: 'inline-block',
                  fontFamily: 'monospace',
                  fontSize: 12,
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  padding: '2px 8px',
                  color: 'var(--text-muted)',
                }}>
                  {selected.lead_id}
                </span>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Body</label>
              <p style={{ margin: 0, fontSize: 14, whiteSpace: 'pre-wrap', color: 'var(--text)', lineHeight: 1.6 }}>{selected.body}</p>
            </div>
            <div className="form-group">
              <label className="form-label">Created</label>
              <p className="td-muted" style={{ margin: 0 }}>{fmtDate(selected.created_at)}</p>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
