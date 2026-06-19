import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Users } from 'lucide-react'
import { get, post } from '../../api'
import Spinner from '../../components/Spinner'
import EmptyState from '../../components/EmptyState'
import Modal from '../../components/Modal'

export default function Contacts() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '', company: '', title: '' })

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => get('/contacts'),
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
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}><Plus size={15} /> New Contact</button>
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
                    <tr key={c.id}>
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
        {[['name', 'Name *'], ['email', 'Email'], ['phone', 'Phone'], ['company', 'Company'], ['title', 'Title']].map(([k, l]) => (
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
