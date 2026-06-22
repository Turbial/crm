import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Users, ChevronUp, ChevronDown, ChevronsUpDown, Trash2 } from 'lucide-react'
import { get, post, del } from '../../api'
import EmptyState from '../../components/EmptyState'
import Modal from '../../components/Modal'
import Pagination from '../../components/Pagination'
import Avatar from '../../components/Avatar'

export default function Contacts() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [showCreate, setShowCreate] = useState(false)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [form, setForm] = useState({ name: '', email: '', phone: '', title: '' })
  const [offset, setOffset] = useState(0)
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [selectedIds, setSelectedIds] = useState(new Set())

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setOffset(0) }, 300)
    return () => clearTimeout(t)
  }, [search])

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['contacts', debouncedSearch, offset],
    queryFn: () => get('/contacts', { ...(debouncedSearch ? { q: debouncedSearch } : {}), limit: 50, offset }),
  })

  const create = useMutation({
    mutationFn: body => post('/contacts', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contacts'] }); setShowCreate(false) },
  })

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function SortIcon({ col }) {
    if (sortKey !== col) return <ChevronsUpDown size={13} style={{ opacity: 0.4, marginLeft: 4 }} />
    return sortDir === 'asc'
      ? <ChevronUp size={13} style={{ marginLeft: 4 }} />
      : <ChevronDown size={13} style={{ marginLeft: 4 }} />
  }

  const sorted = sortKey
    ? [...contacts].sort((a, b) => {
        const av = (a[sortKey] || '').toLowerCase()
        const bv = (b[sortKey] || '').toLowerCase()
        const cmp = av.localeCompare(bv)
        return sortDir === 'asc' ? cmp : -cmp
      })
    : contacts

  const allSelected = sorted.length > 0 && sorted.every(c => selectedIds.has(c.id))
  const someSelected = sorted.some(c => selectedIds.has(c.id)) && !allSelected

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(sorted.map(c => c.id)))
    }
  }

  function toggleRow(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleBulkDelete() {
    const n = selectedIds.size
    if (!window.confirm(`Delete ${n} contact${n !== 1 ? 's' : ''}?`)) return
    await Promise.all([...selectedIds].map(id => del(`/contacts/${id}`)))
    qc.invalidateQueries({ queryKey: ['contacts'] })
    setSelectedIds(new Set())
  }

  return (
    <div>
      <div className="page-header">
        <div><h1>Contacts</h1><p>{contacts.length} records</p></div>
        <div className="flex gap-2 items-center">
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              className="form-input"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search contacts…"
              style={{ width: 200, paddingLeft: 32 }}
            />
          </div>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}><Plus size={15} /> New Contact</button>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3" style={{ marginBottom: 12, padding: '8px 12px', background: 'var(--accent-soft)', borderRadius: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>{selectedIds.size} contact{selectedIds.size !== 1 ? 's' : ''} selected</span>
          <button className="btn btn-danger" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={handleBulkDelete}>
            <Trash2 size={14} /> Delete
          </button>
          <button className="btn btn-ghost" style={{ marginLeft: 'auto' }} onClick={() => setSelectedIds(new Set())}>Clear</button>
        </div>
      )}

      {!isLoading && contacts.length === 0
        ? <EmptyState icon={Users} title="No contacts yet" action={<button className="btn btn-primary" onClick={() => setShowCreate(true)}>Add contact</button>} />
        : (
          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={el => { if (el) el.indeterminate = someSelected }}
                        onChange={toggleAll}
                      />
                    </th>
                    <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('name')}>
                      <span style={{ display: 'inline-flex', alignItems: 'center' }}>Name <SortIcon col="name" /></span>
                    </th>
                    <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('email')}>
                      <span style={{ display: 'inline-flex', alignItems: 'center' }}>Email <SortIcon col="email" /></span>
                    </th>
                    <th>Phone</th>
                    <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('company')}>
                      <span style={{ display: 'inline-flex', alignItems: 'center' }}>Company <SortIcon col="company" /></span>
                    </th>
                    <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('title')}>
                      <span style={{ display: 'inline-flex', alignItems: 'center' }}>Title <SortIcon col="title" /></span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading
                    ? Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i}>
                          <td colSpan={6} className="skeleton skeleton-row" />
                        </tr>
                      ))
                    : sorted.map(c => (
                        <tr
                          key={c.id}
                          style={{ cursor: 'pointer', background: selectedIds.has(c.id) ? 'var(--accent-soft)' : undefined }}
                          onClick={() => navigate(`/crm/contacts/${c.id}`)}
                        >
                          <td style={{ width: 40 }} onClick={e => { e.stopPropagation(); toggleRow(c.id) }}>
                            <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleRow(c.id)} />
                          </td>
                          <td className="td-title">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <Avatar name={c.name} size={28} />
                              {c.name}
                            </div>
                          </td>
                          <td className="td-muted">{c.email || '—'}</td>
                          <td className="td-muted">{c.phone || '—'}</td>
                          <td className="td-muted">{c.company || '—'}</td>
                          <td className="td-muted">{c.title || '—'}</td>
                        </tr>
                      ))
                  }
                </tbody>
              </table>
            </div>
            <Pagination offset={offset} limit={50} hasMore={contacts.length === 50} onChange={setOffset} />
          </div>
        )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Contact"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={create.isPending} onClick={() => create.mutate(form)}>
            {create.isPending ? 'Creating…' : 'Create'}
          </button>
        </>}>
        {[['name', 'Name *'], ['email', 'Email'], ['phone', 'Phone'], ['title', 'Title']].map(([k, l]) => (
          <div key={k} className="form-group">
            <label className="form-label">{l}</label>
            <input className="form-input" value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />
          </div>
        ))}
        {create.isError && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{create.error.message}</p>}
      </Modal>
    </div>
  )
}
