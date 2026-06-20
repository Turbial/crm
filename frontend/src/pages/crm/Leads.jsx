import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus, Search, Users } from 'lucide-react'
import { get, post } from '../../api'
import Spinner from '../../components/Spinner'
import Badge from '../../components/Badge'
import EmptyState from '../../components/EmptyState'
import Modal from '../../components/Modal'

const STATUSES = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost']

export default function Leads() {
  const qc = useQueryClient()
  const [filter, setFilter] = useState('')
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', company: '', email: '', phone: '', status: 'new', source: 'manual' })

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads', filter, search],
    queryFn: () => get('/leads', {
      ...(filter ? { status: filter } : {}),
      ...(search ? { q: search } : {}),
      limit: 200,
    }),
  })

  const create = useMutation({
    mutationFn: body => post('/leads', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leads'] }); setShowCreate(false) },
  })

  if (isLoading) return <Spinner />

  return (
    <div>
      <div className="page-header">
        <div><h1>Leads</h1><p>{leads.length} records</p></div>
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

      {leads.length === 0
        ? <EmptyState icon={Users} title="No leads yet" description="Create your first lead to get started." action={<button className="btn btn-primary" onClick={() => setShowCreate(true)}>Create lead</button>} />
        : (
          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th><th>Company</th><th>Email</th><th>Status</th><th>Score</th><th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map(l => (
                    <tr key={l.id}>
                      <td><Link to={`/crm/leads/${l.id}`} className="td-title" style={{ color: 'var(--accent)' }}>{l.name}</Link></td>
                      <td className="td-muted">{l.company || '—'}</td>
                      <td className="td-muted">{l.email || '—'}</td>
                      <td><Badge label={l.status} /></td>
                      <td><span className="font-medium">{l.score}</span></td>
                      <td className="td-muted">{l.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
