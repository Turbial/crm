import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Briefcase } from 'lucide-react'
import { get, post } from '../../api'
import Spinner from '../../components/Spinner'
import Badge from '../../components/Badge'
import EmptyState from '../../components/EmptyState'
import Modal from '../../components/Modal'

function fmt(n) {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export default function Deals() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', value: '', currency: 'USD' })

  const { data: deals = [], isLoading } = useQuery({
    queryKey: ['deals'],
    queryFn: () => get('/deals'),
  })

  const create = useMutation({
    mutationFn: body => post('/deals', { ...body, value: parseFloat(body.value) || 0 }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['deals'] }); setShowCreate(false) },
  })

  if (isLoading) return <Spinner />

  const totalValue = deals.reduce((s, d) => s + (d.value || 0), 0)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Deals</h1>
          <p>{deals.length} deals · {fmt(totalValue)} total pipeline</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}><Plus size={15} /> New Deal</button>
      </div>

      {deals.length === 0
        ? <EmptyState icon={Briefcase} title="No deals yet" action={<button className="btn btn-primary" onClick={() => setShowCreate(true)}>Create deal</button>} />
        : (
          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Deal Name</th><th>Value</th><th>Currency</th><th>Close Date</th><th>Created</th></tr></thead>
                <tbody>
                  {deals.map(d => (
                    <tr key={d.id}>
                      <td className="td-title">{d.name}</td>
                      <td><span className="font-medium" style={{ color: 'var(--success)' }}>{fmt(d.value)}</span></td>
                      <td className="td-muted">{d.currency || 'USD'}</td>
                      <td className="td-muted">{d.close_date ? new Date(d.close_date).toLocaleDateString() : '—'}</td>
                      <td className="td-muted">{new Date(d.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Deal"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={create.isPending} onClick={() => create.mutate(form)}>
            {create.isPending ? 'Creating…' : 'Create'}
          </button>
        </>}>
        <div className="form-group"><label className="form-label">Deal Name *</label><input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
        <div className="form-group"><label className="form-label">Value</label><input className="form-input" type="number" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} /></div>
        <div className="form-group"><label className="form-label">Currency</label>
          <select className="form-input" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
            {['USD', 'EUR', 'GBP', 'CAD', 'AUD'].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        {create.isError && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{create.error.message}</p>}
      </Modal>
    </div>
  )
}
