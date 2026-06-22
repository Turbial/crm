import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus, Search, Users, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { get, post, patch, del } from '../../api'
import Badge from '../../components/Badge'
import EmptyState from '../../components/EmptyState'
import Modal from '../../components/Modal'
import Pagination from '../../components/Pagination'

const STATUSES = ['new', 'contacted', 'qualified', 'appointment', 'proposal', 'won', 'lost']
const LIMIT = 50

const SORT_COLS = [
  { key: 'name', label: 'Name' },
  { key: 'company', label: 'Company' },
  { key: 'email', label: 'Email' },
  { key: 'status', label: 'Status' },
  { key: 'score', label: 'Score' },
  { key: 'source', label: 'Source' },
]

function SortIcon({ col, sortKey, sortDir }) {
  if (sortKey !== col) return <ChevronsUpDown size={13} style={{ color: 'var(--text-muted)', marginLeft: 4, flexShrink: 0 }} />
  return sortDir === 'asc'
    ? <ChevronUp size={13} style={{ color: 'var(--accent)', marginLeft: 4, flexShrink: 0 }} />
    : <ChevronDown size={13} style={{ color: 'var(--accent)', marginLeft: 4, flexShrink: 0 }} />
}

export default function Leads() {
  const qc = useQueryClient()
  const [filter, setFilter] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', company: '', email: '', phone: '', status: 'new', source: 'manual' })
  const [offset, setOffset] = useState(0)
  const [sortKey, setSortKey] = useState('')
  const [sortDir, setSortDir] = useState('asc')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [bulkStatus, setBulkStatus] = useState('')
  const selectAllRef = useRef(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    setOffset(0)
  }, [filter, debouncedSearch])

  useEffect(() => {
    setSelectedIds(new Set())
  }, [offset, filter, debouncedSearch])

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads', filter, debouncedSearch, offset],
    queryFn: () => get('/leads', {
      ...(filter ? { status: filter } : {}),
      ...(debouncedSearch ? { q: debouncedSearch } : {}),
      limit: LIMIT,
      offset,
    }),
  })

  const create = useMutation({
    mutationFn: body => post('/leads', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leads'] }); setShowCreate(false) },
  })

  const bulkPatch = useMutation({
    mutationFn: ({ ids, status }) => Promise.all([...ids].map(id => patch(`/leads/${id}`, { status }))),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leads'] }); setSelectedIds(new Set()); setBulkStatus('') },
  })

  const bulkDelete = useMutation({
    mutationFn: ids => Promise.all([...ids].map(id => del(`/leads/${id}`))),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leads'] }); setSelectedIds(new Set()) },
  })

  const sorted = [...leads].sort((a, b) => {
    if (!sortKey) return 0
    const av = a[sortKey] ?? ''
    const bv = b[sortKey] ?? ''
    const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' })
    return sortDir === 'asc' ? cmp : -cmp
  })

  function handleSort(col) {
    if (sortKey === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(col)
      setSortDir('asc')
    }
  }

  const allSelected = leads.length > 0 && selectedIds.size === leads.length
  const someSelected = selectedIds.size > 0 && selectedIds.size < leads.length

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected
    }
  }, [someSelected])

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(leads.map(l => l.id)))
    }
  }

  function toggleOne(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleBulkDelete() {
    if (!window.confirm(`Delete ${selectedIds.size} lead${selectedIds.size > 1 ? 's' : ''}? This cannot be undone.`)) return
    bulkDelete.mutate(selectedIds)
  }

  function handleBulkStatus(e) {
    const status = e.target.value
    if (!status) return
    setBulkStatus(status)
    bulkPatch.mutate({ ids: selectedIds, status })
  }

  const pageStart = offset + 1
  const pageEnd = offset + leads.length

  return (
    <div>
      <div className="page-header">
        <div><h1>Leads</h1><p>{leads.length < LIMIT ? `${pageStart}–${pageEnd} records` : `Page ${Math.floor(offset / LIMIT) + 1}`}</p></div>
        <div className="flex gap-2 items-center">
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              className="form-input"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search leads…"
              style={{ width: 200, paddingLeft: 32 }}
            />
          </div>
          <select className="form-input" value={filter} onChange={e => setFilter(e.target.value)} style={{ width: 150 }}>
            <option value="">All statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}><Plus size={15} /> New Lead</button>
        </div>
      </div>

      {!isLoading && leads.length === 0
        ? <EmptyState icon={Users} title="No leads yet" description="Create your first lead to get started." action={<button className="btn btn-primary" onClick={() => setShowCreate(true)}>Create lead</button>} />
        : (
          <div className="card" style={{ padding: 0 }}>
            {selectedIds.size > 0 && (
              <div style={{ background: 'var(--accent-soft)', padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ color: 'var(--accent)', fontWeight: 500, fontSize: 13 }}>{selectedIds.size} lead{selectedIds.size > 1 ? 's' : ''} selected</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Change Status →</span>
                  <select
                    className="form-input"
                    value={bulkStatus}
                    onChange={handleBulkStatus}
                    disabled={bulkPatch.isPending}
                    style={{ width: 140, padding: '3px 8px', fontSize: 12 }}
                  >
                    <option value="">Pick status…</option>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </span>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={handleBulkDelete}
                  disabled={bulkDelete.isPending}
                >
                  Delete
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setSelectedIds(new Set())}
                  style={{ marginLeft: 'auto' }}
                >
                  Clear
                </button>
              </div>
            )}
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 40, textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        ref={selectAllRef}
                        checked={allSelected}
                        onChange={toggleAll}
                      />
                    </th>
                    {SORT_COLS.map(col => (
                      <th
                        key={col.key}
                        onClick={() => handleSort(col.key)}
                        style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                          {col.label}
                          <SortIcon col={col.key} sortKey={sortKey} sortDir={sortDir} />
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isLoading
                    ? Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i}>
                          <td colSpan={7}><div className="skeleton skeleton-row" /></td>
                        </tr>
                      ))
                    : sorted.map(l => (
                        <tr key={l.id}>
                          <td style={{ width: 40, textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={selectedIds.has(l.id)}
                              onChange={() => toggleOne(l.id)}
                            />
                          </td>
                          <td><Link to={`/crm/leads/${l.id}`} className="td-title" style={{ color: 'var(--accent)' }}>{l.name}</Link></td>
                          <td className="td-muted">{l.company || '—'}</td>
                          <td className="td-muted">{l.email || '—'}</td>
                          <td><Badge label={l.status} /></td>
                          <td><span className="font-medium">{l.score}</span></td>
                          <td className="td-muted">{l.source}</td>
                        </tr>
                      ))
                  }
                </tbody>
              </table>
            </div>
            <div style={{ padding: '0 16px 16px' }}>
              <Pagination offset={offset} limit={LIMIT} hasMore={leads.length === LIMIT} onChange={setOffset} />
            </div>
          </div>
        )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Lead"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={create.isPending} onClick={() => create.mutate(form)}>
            {create.isPending ? 'Creating…' : 'Create'}
          </button>
        </>}>
        {[['name', 'Name *'], ['company', 'Company'], ['email', 'Email'], ['phone', 'Phone']].map(([k, l]) => (
          <div key={k} className="form-group">
            <label className="form-label">{l}</label>
            <input className="form-input" value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />
          </div>
        ))}
        <div className="form-group">
          <label className="form-label">Status</label>
          <select className="form-input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {create.isError && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{create.error.message}</p>}
      </Modal>
    </div>
  )
}
