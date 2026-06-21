import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, Briefcase, Search, LayoutGrid, List } from 'lucide-react'
import { get, post } from '../../api'
import Spinner from '../../components/Spinner'
import Badge from '../../components/Badge'
import EmptyState from '../../components/EmptyState'
import Modal from '../../components/Modal'

const STAGES = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost']

function fmt(n) {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
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

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const { data: deals = [], isLoading } = useQuery({
    queryKey: ['deals', debouncedSearch],
    queryFn: () => get('/deals', { ...(debouncedSearch ? { q: debouncedSearch } : {}), limit: 200 }),
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

  if (isLoading && view === 'list') return <Spinner />

  const totalValue = deals.reduce((s, d) => s + (d.value || 0), 0)

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
        deals.length === 0
          ? <EmptyState icon={Briefcase} title="No deals yet" action={<button className="btn btn-primary" onClick={() => setShowCreate(true)}>Create deal</button>} />
          : (
            <div className="card" style={{ padding: 0 }}>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Deal Name</th><th>Stage</th><th>Value</th><th>Close Date</th><th>Created</th></tr></thead>
                  <tbody>
                    {deals.map(d => (
                      <tr key={d.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/crm/deals/${d.id}`)}>
                        <td className="td-title">{d.title || d.name}</td>
                        <td><Badge label={d.stage || 'lead'} /></td>
                        <td><span className="font-medium" style={{ color: 'var(--success)' }}>{fmt(d.value)}</span></td>
                        <td className="td-muted">{d.expected_close_date ? new Date(d.expected_close_date).toLocaleDateString() : '—'}</td>
                        <td className="td-muted">{new Date(d.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
      )}

      {view === 'board' && (
        boardLoading
          ? <Spinner />
          : (
            <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 16 }}>
              {(boardData?.stages || []).map(stage => (
                <div key={stage.name} style={{ minWidth: 240, maxWidth: 240, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 2px' }}>
                    <span style={{ fontWeight: 600, fontSize: 13, textTransform: 'capitalize' }}>{stage.name}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-subtle)', borderRadius: 99, padding: '1px 7px' }}>{stage.deals?.length || 0}</span>
                  </div>
                  {(stage.deals || []).map(d => (
                    <div key={d.id} className="kanban-card" style={{ cursor: 'pointer' }} onClick={() => navigate(`/crm/deals/${d.id}`)}>
                      <div className="kanban-card-title">{d.title}</div>
                      <div className="kanban-card-meta">
                        <span style={{ fontWeight: 600, color: 'var(--success)', fontSize: 13 }}>{fmt(d.value)}</span>
                        {d.status && <Badge label={d.status} />}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
              <div style={{ minWidth: 180, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ padding: '6px 2px' }}>
                  <button className="btn btn-secondary btn-sm flex gap-1 items-center" onClick={() => setShowAddStage(true)}>
                    <Plus size={13} /> Add Stage
                  </button>
                </div>
              </div>
            </div>
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
