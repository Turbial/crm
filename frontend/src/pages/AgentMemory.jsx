import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Database } from 'lucide-react'
import { get, del, api } from '../api'
import Spinner from '../components/Spinner'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'

const fmtDate = d => d ? new Date(d).toLocaleString() : '—'

function prettyValue(val) {
  if (val == null) return ''
  if (typeof val === 'object') {
    try { return JSON.stringify(val, null, 2) } catch { return String(val) }
  }
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val)
      if (typeof parsed === 'object' && parsed !== null) return JSON.stringify(parsed, null, 2)
    } catch { }
  }
  return String(val)
}

function parseValue(str) {
  try { return JSON.parse(str) } catch { return str }
}

const emptyAddForm = { agent_name: '', key: '', value: '' }

export default function AgentMemory() {
  const qc = useQueryClient()
  const [filter, setFilter] = useState('')
  const [selected, setSelected] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState(emptyAddForm)

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['agent-memory'],
    queryFn: () => get('/agent-memory', { limit: 100 }),
  })

  const saveMut = useMutation({
    mutationFn: body => api('/agent-memory', { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent-memory'] }),
  })

  const deleteMut = useMutation({
    mutationFn: ({ agent, key }) => del(`/agent-memory/${encodeURIComponent(agent)}/${encodeURIComponent(key)}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent-memory'] })
      setSelected(null)
    },
  })

  const addMut = useMutation({
    mutationFn: body => api('/agent-memory', { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent-memory'] })
      setShowAddModal(false)
      setAddForm(emptyAddForm)
    },
  })

  const filtered = useMemo(() => {
    if (!filter.trim()) return entries
    const q = filter.toLowerCase()
    return entries.filter(e =>
      (e.agent_name || '').toLowerCase().includes(q) ||
      (e.key || '').toLowerCase().includes(q)
    )
  }, [entries, filter])

  const grouped = useMemo(() => {
    const map = {}
    for (const entry of filtered) {
      const agent = entry.agent_name || '(unknown)'
      if (!map[agent]) map[agent] = []
      map[agent].push(entry)
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  function selectEntry(entry) {
    setSelected(entry)
    setEditValue(prettyValue(entry.value))
  }

  function handleSave() {
    if (!selected) return
    saveMut.mutate({
      agent_name: selected.agent_name,
      key: selected.key,
      value: parseValue(editValue),
    })
  }

  function handleDelete() {
    if (!selected) return
    if (!window.confirm(`Delete "${selected.agent_name} / ${selected.key}"?`)) return
    deleteMut.mutate({ agent: selected.agent_name, key: selected.key })
  }

  function submitAdd() {
    addMut.mutate({
      agent_name: addForm.agent_name,
      key: addForm.key,
      value: parseValue(addForm.value),
    })
  }

  if (isLoading) return <Spinner />

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Agent Memory</h1>
          <p>AI agent key-value state store</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          Add Entry
        </button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <input
          className="form-input"
          style={{ maxWidth: 320 }}
          placeholder="Filter by agent or key…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
      </div>

      {entries.length === 0 && (
        <EmptyState icon={Database} title="No agent memory entries" description="Agent memory entries will appear here as AI agents run." />
      )}

      {entries.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, alignItems: 'start' }}>
          <div className="card" style={{ padding: 0 }}>
            {grouped.length === 0 && (
              <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 13 }}>No matches</div>
            )}
            {grouped.map(([agent, agentEntries]) => (
              <div key={agent}>
                <div
                  style={{
                    padding: '10px 16px 6px',
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--text-muted)',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}
                >
                  {agent}
                </div>
                {agentEntries.map(entry => (
                  <div
                    key={entry.key}
                    onClick={() => selectEntry(entry)}
                    style={{
                      padding: '8px 16px 8px 28px',
                      cursor: 'pointer',
                      fontSize: 13,
                      borderBottom: '1px solid var(--border-subtle)',
                      background: selected?.agent_name === entry.agent_name && selected?.key === entry.key
                        ? 'var(--accent-subtle, var(--bg))'
                        : 'transparent',
                      color: selected?.agent_name === entry.agent_name && selected?.key === entry.key
                        ? 'var(--accent)'
                        : 'var(--text)',
                    }}
                  >
                    {entry.key}
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="card">
            {!selected && (
              <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '24px 0', textAlign: 'center' }}>
                Select an entry to view or edit
              </div>
            )}
            {selected && (
              <div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 20 }}>
                  <div className="flex gap-2 items-center">
                    <span className="text-xs td-muted" style={{ minWidth: 80 }}>Agent</span>
                    <span className="font-medium text-sm" style={{ color: 'var(--text-muted)' }}>{selected.agent_name}</span>
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className="text-xs td-muted" style={{ minWidth: 80 }}>Key</span>
                    <span className="font-medium text-sm" style={{ color: 'var(--text-muted)' }}>{selected.key}</span>
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className="text-xs td-muted" style={{ minWidth: 80 }}>Updated</span>
                    <span className="text-xs td-muted">{fmtDate(selected.updated_at)}</span>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Value</label>
                  <textarea
                    className="form-input"
                    rows={12}
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    style={{ fontFamily: 'monospace', fontSize: 13, resize: 'vertical' }}
                  />
                </div>

                {(saveMut.isError || deleteMut.isError) && (
                  <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>
                    {(saveMut.error || deleteMut.error)?.message}
                  </p>
                )}

                <div className="flex gap-2 items-center" style={{ justifyContent: 'space-between' }}>
                  <button
                    className="btn btn-danger btn-sm"
                    disabled={deleteMut.isPending}
                    onClick={handleDelete}
                  >
                    {deleteMut.isPending ? 'Deleting…' : 'Delete'}
                  </button>
                  <button
                    className="btn btn-primary"
                    disabled={saveMut.isPending}
                    onClick={handleSave}
                  >
                    {saveMut.isPending ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <Modal
        open={showAddModal}
        onClose={() => { setShowAddModal(false); setAddForm(emptyAddForm) }}
        title="Add Memory Entry"
        footer={
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => { setShowAddModal(false); setAddForm(emptyAddForm) }}>Cancel</button>
            <button
              className="btn btn-primary"
              disabled={addMut.isPending || !addForm.agent_name || !addForm.key}
              onClick={submitAdd}
            >
              {addMut.isPending ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Agent Name *</label>
          <input
            className="form-input"
            placeholder="e.g. lead_qualifier"
            value={addForm.agent_name}
            onChange={e => setAddForm(f => ({ ...f, agent_name: e.target.value }))}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Key *</label>
          <input
            className="form-input"
            placeholder="e.g. last_processed_id"
            value={addForm.key}
            onChange={e => setAddForm(f => ({ ...f, key: e.target.value }))}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Value</label>
          <textarea
            className="form-input"
            rows={5}
            placeholder='e.g. "abc123" or {"count": 0}'
            value={addForm.value}
            onChange={e => setAddForm(f => ({ ...f, value: e.target.value }))}
            style={{ fontFamily: 'monospace', fontSize: 13, resize: 'vertical' }}
          />
        </div>
        {addMut.isError && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{addMut.error.message}</p>}
      </Modal>
    </div>
  )
}
