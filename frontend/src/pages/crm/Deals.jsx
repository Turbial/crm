import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, Briefcase, Search, LayoutGrid, List, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { get, post, patch, del } from '../../api'
import Spinner from '../../components/Spinner'
import Badge from '../../components/Badge'
import EmptyState from '../../components/EmptyState'
import Modal from '../../components/Modal'
import Pagination from '../../components/Pagination'
import KanbanBoard from '../../components/KanbanBoard'

const STAGES = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost']

function fmt(n) {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function SortIcon({ col, sortKey, sortDir }) {
  if (sortKey !== col) return <ChevronsUpDown size={13} style={{ color: 'var(--text-muted)', marginLeft: 4 }} />
  if (sortDir === 'asc') return <ChevronUp size={13} style={{ color: 'var(--accent)', marginLeft: 4 }} />
  return <ChevronDown size={13} style={{ color: 'var(--accent)', marginLeft: 4 }} />
}

function SkeletonRows() {
  return Array.from({ length: 5 }).map((_, i) => (
    <tr key={i}>
      <td style={{ width: 40 }}><div className="skeleton" style={{ width: 16, height: 16, borderRadius: 3 }} /></td>
      <td><div className="skeleton" style={{ width: '60%', height: 14 }} /></td>
      <td><div className="skeleton" style={{ width: 70, height: 20, borderRadius: 99 }} /></td>
      <td><div className="skeleton" style={{ width: 80, height: 14 }} /></td>
      <td><div className="skeleton" style={{ width: 90, height: 14 }} /></td>
      <td><div className="skeleton" style={{ width: 90, height: 14 }} /></td>
    </tr>
  ))
}

export default function Deals() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [showCreate, setShowCreate] = useState(false)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [form, setForm] = useState({ title: '', value: '', currency: 'USD', stage: 'lead', close_date: '' })
  const [view, setView] = useState('list')
  const [showAddStage, setShowAddStage] = useState(false)
  const [stageForm, setStageForm] = useState({ name: '' })
  const [offset, setOffset] = useState(0)
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [bulkStage, setBulkStage] = useState('')
  const selectAllRef = useRef(null)

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setOffset(0) }, 300)
    return () => clearTimeout(t)
  }, [search])

  const { data: deals = [], isLoading } = useQuery({
    queryKey: ['deals', debouncedSearch, offset],
    queryFn: () => get('/deals', { ...(debouncedSearch ? { q: debouncedSearch } : {}), limit: 50, offset }),
    enabled: view === 'list',
  })

  const { data: boardData, isLoading: boardLoading } = useQuery({
    queryKey: ['deals-board'],
    queryFn: () => get('/deals/board'),
    enabled: view === 'board',
  })

  const addStage = useMutation({
    mutationFn: body => post('/deals/stages', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['deals-board'] }); setShowAddStage(false); setStageForm({ name: '' }) },
  })

  const create = useMutation({
    mutationFn: body => post('/deals', {
      title: body.title,
      value: parseFloat(body.value) || 0,
      currency: body.currency,
      stage: body.stage,
      expected_close_date: body.close_date || undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['deals'] }); setShowCreate(false); setForm({ title: '', value: '', currency: 'USD', stage: 'lead', close_date: '' }) },
  })

  const moveCard = useMutation({
    mutationFn: ({ id, stage }) => patch(`/deals/${id}`, { stage }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deals-board'] }),
  })

  function handleSort(col) {
    if (sortKey === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(col)
      setSortDir('asc')
    }
  }

  function sortedDeals() {
    if (!sortKey) return deals
    return [...deals].sort((a, b) => {
      let av, bv
      if (sortKey === 'value') {
        av = a.value ?? -Infinity
        bv = b.value ?? -Infinity
      } else if (sortKey === 'close_date') {
        av = a.expected_close_date || ''
        bv = b.expected_close_date || ''
      } else if (sortKey === 'created') {
        av = a.created_at || ''
        bv = b.created_at || ''
      } else if (sortKey === 'title') {
        av = (a.title || a.name || '').toLowerCase()
        bv = (b.title || b.name || '').toLowerCase()
      } else if (sortKey === 'stage') {
        av = (a.stage || '').toLowerCase()
        bv = (b.stage || '').toLowerCase()
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }

  const visibleDeals = sortedDeals()
  const allSelected = visibleDeals.length > 0 && visibleDeals.every(d => selectedIds.has(d.id))
  const someSelected = visibleDeals.some(d => selectedIds.has(d.id)) && !allSelected

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected
    }
  }, [someSelected])

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(visibleDeals.map(d => d.id)))
    }
  }

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function bulkMoveStage() {
    if (!bulkStage) return
    await Promise.all([...selectedIds].map(id => patch(`/deals/${id}`, { stage: bulkStage })))
    qc.invalidateQueries({ queryKey: ['deals'] })
    setSelectedIds(new Set())
    setBulkStage('')
  }

  async function bulkDelete() {
    if (!window.confirm(`Delete ${selectedIds.size} deal${selectedIds.size !== 1 ? 's' : ''}? This cannot be undone.`)) return
    await Promise.all([...selectedIds].map(id => del(`/deals/${id}`)))
    qc.invalidateQueries({ queryKey: ['deals'] })
    setSelectedIds(new Set())
  }

  const thStyle = { cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }
  const thInner = { display: 'flex', alignItems: 'center', gap: 2 }

  const totalValue = deals.reduce((s, d) => s + (d.value || 0), 0)

  const kanbanColumns = (boardData?.stages || []).map(stage => ({
    column: { id: stage.name, label: stage.name },
    tasks: stage.deals || [],
    count: (stage.deals || []).length,
  }))

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Deals</h1>
          <p>{deals.length} deals · {fmt(totalValue)} total pipeline</p>
        </div>
        <div className="flex gap-2 items-center">
          <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
            <button
              onClick={() => setView('list')}
              style={{ padding: '5px 10px', background: view === 'list' ? 'var(--accent)' : 'transparent', color: view === 'list' ? '#fff' : 'var(--text-muted)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            ><List size={14} /> List</button>
            <button
              onClick={() => setView('board')}
              style={{ padding: '5px 10px', background: view === 'board' ? 'var(--accent)' : 'transparent', color: view === 'board' ? '#fff' : 'var(--text-muted)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            ><LayoutGrid size={14} /> Board</button>
          </div>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              className="form-input"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search deals…"
              style={{ width: 200, paddingLeft: 32 }}
            />
          </div>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}><Plus size={15} /> New Deal</button>
        </div>
      </div>

      {view === 'list' && (
        isLoading
          ? (
            <div className="card" style={{ padding: 0 }}>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 40 }} />
                      <th>Deal Name</th>
                      <th>Stage</th>
                      <th>Value</th>
                      <th>Close Date</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody><SkeletonRows /></tbody>
                </table>
              </div>
            </div>
          )
          : deals.length === 0
            ? <EmptyState icon={Briefcase} title="No deals yet" action={<button className="btn btn-primary" onClick={() => setShowCreate(true)}>Create deal</button>} />
            : (
              <>
                {selectedIds.size > 0 && (
                  <div style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent)', borderRadius: 8, padding: '10px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{selectedIds.size} deal{selectedIds.size !== 1 ? 's' : ''} selected</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Move to Stage →</span>
                      <select
                        className="form-input"
                        style={{ width: 150, padding: '3px 8px', fontSize: 13 }}
                        value={bulkStage}
                        onChange={e => setBulkStage(e.target.value)}
                      >
                        <option value="">Select stage…</option>
                        {STAGES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                      </select>
                      <button className="btn btn-primary btn-sm" disabled={!bulkStage} onClick={bulkMoveStage}>Apply</button>
                    </div>
                    <button className="btn btn-danger btn-sm" onClick={bulkDelete}>Delete</button>
                    <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setSelectedIds(new Set())}>Clear</button>
                  </div>
                )}
                <div className="card" style={{ padding: 0 }}>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th style={{ width: 40 }}>
                            <input
                              type="checkbox"
                              ref={selectAllRef}
                              checked={allSelected}
                              onChange={toggleSelectAll}
                            />
                          </th>
                          <th style={thStyle} onClick={() => handleSort('title')}>
                            <div style={thInner}>Deal Name <SortIcon col="title" sortKey={sortKey} sortDir={sortDir} /></div>
                          </th>
                          <th style={thStyle} onClick={() => handleSort('stage')}>
                            <div style={thInner}>Stage <SortIcon col="stage" sortKey={sortKey} sortDir={sortDir} /></div>
                          </th>
                          <th style={thStyle} onClick={() => handleSort('value')}>
                            <div style={thInner}>Value <SortIcon col="value" sortKey={sortKey} sortDir={sortDir} /></div>
                          </th>
                          <th style={thStyle} onClick={() => handleSort('close_date')}>
                            <div style={thInner}>Close Date <SortIcon col="close_date" sortKey={sortKey} sortDir={sortDir} /></div>
                          </th>
                          <th style={thStyle} onClick={() => handleSort('created')}>
                            <div style={thInner}>Created <SortIcon col="created" sortKey={sortKey} sortDir={sortDir} /></div>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleDeals.map(d => (
                          <tr key={d.id} style={{ cursor: 'pointer' }}>
                            <td style={{ width: 40 }} onClick={e => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={selectedIds.has(d.id)}
                                onChange={() => toggleSelect(d.id)}
                              />
                            </td>
                            <td className="td-title" onClick={() => navigate(`/crm/deals/${d.id}`)}>{d.title || d.name}</td>
                            <td onClick={() => navigate(`/crm/deals/${d.id}`)}><Badge label={d.stage || 'lead'} /></td>
                            <td onClick={() => navigate(`/crm/deals/${d.id}`)}><span className="font-medium" style={{ color: 'var(--success)' }}>{fmt(d.value)}</span></td>
                            <td className="td-muted" onClick={() => navigate(`/crm/deals/${d.id}`)}>{d.expected_close_date ? new Date(d.expected_close_date).toLocaleDateString() : '—'}</td>
                            <td className="td-muted" onClick={() => navigate(`/crm/deals/${d.id}`)}>{new Date(d.created_at).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <Pagination offset={offset} limit={50} hasMore={deals.length === 50} onChange={setOffset} />
              </>
            )
      )}

      {view === 'board' && (
        boardLoading
          ? <Spinner />
          : (
            <>
              <KanbanBoard
                columns={kanbanColumns}
                onCardMove={(task, targetColumn) => {
                  moveCard.mutate({ id: task.id, stage: targetColumn.label.toLowerCase() })
                }}
                onCardClick={task => navigate(`/crm/deals/${task.id}`)}
                renderCard={(deal) => (
                  <div>
                    <div className="kanban-card-title">{deal.title}</div>
                    <div className="kanban-card-meta">
                      <span style={{ color: 'var(--success)', fontWeight: 600 }}>{fmt(deal.value)}</span>
                    </div>
                  </div>
                )}
              />
              <div style={{ marginTop: 16 }}>
                <button className="btn btn-secondary btn-sm flex gap-1 items-center" onClick={() => setShowAddStage(true)}>
                  <Plus size={13} /> Add Stage
                </button>
              </div>
            </>
          )
      )}

      <Modal open={showAddStage} onClose={() => setShowAddStage(false)} title="Add Stage"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowAddStage(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={addStage.isPending || !stageForm.name.trim()} onClick={() => addStage.mutate(stageForm)}>
            {addStage.isPending ? 'Adding…' : 'Add'}
          </button>
        </>}>
        <div className="form-group">
          <label className="form-label">Stage Name *</label>
          <input className="form-input" value={stageForm.name} onChange={e => setStageForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Discovery" autoFocus />
        </div>
        {addStage.isError && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{addStage.error.message}</p>}
      </Modal>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Deal"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={create.isPending || !form.title.trim()} onClick={() => create.mutate(form)}>
            {create.isPending ? 'Creating…' : 'Create'}
          </button>
        </>}>
        <div className="form-group">
          <label className="form-label">Deal Name *</label>
          <input className="form-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Enterprise license" />
        </div>
        <div className="form-group">
          <label className="form-label">Stage</label>
          <select className="form-input" value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value }))}>
            {STAGES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Value</label>
          <input className="form-input" type="number" min="0" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} placeholder="0" />
        </div>
        <div className="form-group">
          <label className="form-label">Currency</label>
          <select className="form-input" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
            {['USD', 'EUR', 'GBP', 'CAD', 'AUD'].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Expected Close Date</label>
          <input className="form-input" type="date" value={form.close_date} onChange={e => setForm(f => ({ ...f, close_date: e.target.value }))} />
        </div>
        {create.isError && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{create.error.message}</p>}
      </Modal>
    </div>
  )
}
