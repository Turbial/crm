import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Users } from 'lucide-react'
import { get, post } from '../../api'
import Spinner from '../../components/Spinner'
import EmptyState from '../../components/EmptyState'
import Modal from '../../components/Modal'

export default function Contacts() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [showCreate, setShowCreate] = useState(false)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ name: '', email: '', phone: '', title: '' })

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['contacts', search],
    queryFn: () => get('/contacts', { ...(search ? { q: search } : {}), limit: 200 }),
  })

  const create = useMutation({
    mutationFn: body => post('/contacts', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contacts'] }); setShowCreate(false) },
  })

  if (isLoading) return <Spinner />

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

      {contacts.length === 0
        ? <EmptyState icon={Users} title="No contacts yet" action={<button className="btn btn-primary" onClick={() => setShowCreate(true)}>Add contact</button>} />
        : (
          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Company</th><th>Title</th></tr></thead>
                <tbody>
                  {contacts.map(c => (
                    <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/crm/contacts/${c.id}`)}>
                      <td className="td-title">{c.name}</td>
                      <td className="td-muted">{c.email || '—'}</td>
                      <td className="td-muted">{c.phone || '—'}</td>
                      <td className="td-muted">{c.company || '—'}</td>
                      <td className="td-muted">{c.title || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
