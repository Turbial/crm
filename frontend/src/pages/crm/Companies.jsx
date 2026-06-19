import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Building2 } from 'lucide-react'
import { get, post } from '../../api'
import Spinner from '../../components/Spinner'
import EmptyState from '../../components/EmptyState'
import Modal from '../../components/Modal'

export default function Companies() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', domain: '', industry: '', size: '', website: '' })

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ['companies'],
    queryFn: () => get('/companies'),
  })

  const create = useMutation({
    mutationFn: body => post('/companies', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['companies'] }); setShowCreate(false) },
  })

  if (isLoading) return <Spinner />

  return (
    <div>
      <div className="page-header">
        <div><h1>Companies</h1><p>{companies.length} records</p></div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}><Plus size={15} /> New Company</button>
      </div>

      {companies.length === 0
        ? <EmptyState icon={Building2} title="No companies yet" action={<button className="btn btn-primary" onClick={() => setShowCreate(true)}>Add company</button>} />
        : (
          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Name</th><th>Domain</th><th>Industry</th><th>Size</th><th>Website</th></tr></thead>
                <tbody>
                  {companies.map(c => (
                    <tr key={c.id}>
                      <td className="td-title">{c.name}</td>
                      <td className="td-muted">{c.domain || '—'}</td>
                      <td className="td-muted">{c.industry || '—'}</td>
                      <td className="td-muted">{c.size || '—'}</td>
                      <td className="td-muted">{c.website ? <a href={c.website} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>{c.website}</a> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Company"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={create.isPending} onClick={() => create.mutate(form)}>
            {create.isPending ? 'Creating…' : 'Create'}
          </button>
        </>}>
        {[['name', 'Company Name *'], ['domain', 'Domain (e.g. acme.com)'], ['industry', 'Industry'], ['size', 'Size'], ['website', 'Website']].map(([k, l]) => (
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
