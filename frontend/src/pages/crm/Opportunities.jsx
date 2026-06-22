import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, TrendingUp } from 'lucide-react'
import { get, post, patch, del } from '../../api'
import Spinner from '../../components/Spinner'
import Badge from '../../components/Badge'
import EmptyState from '../../components/EmptyState'
import Modal from '../../components/Modal'

const STAGES = ['discovery', 'quoted', 'negotiation', 'won', 'lost']
const STAGE_COLORS = { discovery: 'blue', quoted: 'purple', negotiation: 'yellow', won: 'green', lost: 'red' }

const fmtDate = d => d ? new Date(d).toLocaleString() : '—'
const fmtCurrency = n => n == null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

const EMPTY_FORM = { title: '', lead_id: '', stage: 'discovery', value: '', probability: '', expected_close_date: '', notes: '' }

export default function Opportunities() {
  const qc = useQueryClient()
  const [stageFilter, setStageFilter] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editForm, setEditForm] = useState(EMPTY_FORM)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const { data: opps = [], isLoading } = useQuery({
    queryKey: ['opportunities'],
    queryFn: () => get('/opportunities', { limit: 200 }),
  })

  const create = useMutation({
    mutationFn: body => post('/opportunities', {
      title: body.title,
      lead_id: body.lead_id || undefined,
      stage: body.stage,
      value: body.value !== '' ? parseFloat(body.value) : undefined,
      probability: body.probability !== '' ? parseFloat(body.probability) : undefined,
      expected_close_date: body.expected_close_date || undefined,
      notes: body.notes || undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['opportunities'] }); setShowCreate(false); setForm(EMPTY_FORM) },
  })

  const update = useMutation({
    mutationFn: body => patch(`/opportunities/${selected.id}`, {
      title: body.title,
      stage: body.stage,
      value: body.value !== '' ? parseFloat(body.value) : undefined,
      probability: body.probability !== '' ? parseFloat(body.probability) : undefined,
      expected_close_date: body.expected_close_date || undefined,
      notes: body.notes || undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['opportunities'] }); setSelected(null) },
  })

  const remove = useMutation({
    mutationFn: () => del(`/opportunities/${selected.id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['opportunities'] }); setSelected(null) },
  })

  const filtered = opps
    .filter(o => !stageFilter || o.stage === stageFilter)
    .filter(o => !debouncedSearch || o.title?.toLowerCase().includes(debouncedSearch.toLowerCase()))

  const totalValue = filtered.reduce((s, o) => s + (o.value || 0), 0)

  function openEdit(o) {
    setSelected(o)
    setEditForm({
      title: o.title || '',
      lead_id: o.lead_id || '',
      stage: o.stage || 'discovery',
      value: o.value != null ? String(o.value) : '',
      probability: o.probability != null ? String(o.probability) : '',
      expected_close_date: o.expected_close_date ? o.expected_close_date.slice(0, 10) : '',
      notes: o.notes || '',
    })
  }

  if (isLoading) return <Spinner />

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Opportunities</h1>
          <p>{filtered.length} opportunities · {fmtCurrency(totalValue)} total value</p>
        </div>
        <div className="flex gap-2 items-center">
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              className="form-input"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search opportunities…"
              style={{ width: 220, paddingLeft: 32 }}
            />
          </div>
          <select className="form-input" value={stageFilter} onChange={e => setStageFilter(e.target.value)} style={{ width: 160 }}>
            <option value="">All stages</option>
            {STAGES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}><Plus size={15} /> New Opportunity</button>
        </div>
      </div>

      {filtered.length === 0
        ? <EmptyState icon={TrendingUp} title="No opportunities yet" description="Track your pipeline by creating your first opportunity." action={<button className="btn btn-primary" onClick={() => setShowCreate(true)}>Create opportunity</button>} />
        : (
          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Title</th><th>Stage</th><th>Value</th><th>Probability</th><th>Close Date</th><th>Lead ID</th><th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(o => (
                    <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => openEdit(o)}>
                      <td className="font-medium text-sm">{o.title}</td>
                      <td><Badge label={o.stage} color={STAGE_COLORS[o.stage]} /></td>
                      <td><span className="font-medium" style={{ color: 'var(--success)' }}>{fmtCurrency(o.value)}</span></td>
                      <td className="td-muted">{o.probability != null ? `${o.probability}%` : '—'}</td>
                      <td className="td-muted">{o.expected_close_date ? new Date(o.expected_close_date).toLocaleDateString() : '—'}</td>
                      <td className="td-muted">{o.lead_id ? String(o.lead_id).slice(0, 8) : '—'}</td>
                      <td className="td-muted">{fmtDate(o.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      <Modal open={showCreate} onClose={() => { setShowCreate(false); setForm(EMPTY_FORM) }} title="New Opportunity"
        footer={<>
          <button className="btn btn-secondary" onClick={() => { setShowCreate(false); setForm(EMPTY_FORM) }}>Cancel</button>
          <button className="btn btn-primary" disabled={create.isPending || !form.title.trim()} onClick={() => create.mutate(form)}>
            {create.isPending ? 'Creating…' : 'Create'}
          </button>
        </>}>
        <OpportunityForm form={form} setForm={setForm} />
        {create.isError && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{create.error.message}</p>}
      </Modal>

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Edit Opportunity"
        footer={<>
          <button className="btn btn-danger btn-sm" disabled={remove.isPending} onClick={() => remove.mutate()}>
            {remove.isPending ? 'Deleting…' : 'Delete'}
          </button>
          <div className="flex gap-2 items-center">
            <button className="btn btn-secondary" onClick={() => setSelected(null)}>Cancel</button>
            <button className="btn btn-primary" disabled={update.isPending || !editForm.title.trim()} onClick={() => update.mutate(editForm)}>
              {update.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </>}>
        <OpportunityForm form={editForm} setForm={setEditForm} />
        {update.isError && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{update.error.message}</p>}
        {remove.isError && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{remove.error.message}</p>}
      </Modal>
    </div>
  )
}

function OpportunityForm({ form, setForm }) {
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  return (
    <>
      <div className="form-group">
        <label className="form-label">Title *</label>
        <input className="form-input" value={form.title} onChange={e => set('title', e.target.value)} placeholder="Opportunity title" />
      </div>
      <div className="form-group">
        <label className="form-label">Lead ID</label>
        <input className="form-input" value={form.lead_id} onChange={e => set('lead_id', e.target.value)} placeholder="Lead ID" />
      </div>
      <div className="form-group">
        <label className="form-label">Stage</label>
        <select className="form-input" value={form.stage} onChange={e => set('stage', e.target.value)}>
          {STAGES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Value</label>
        <input className="form-input" type="number" min="0" value={form.value} onChange={e => set('value', e.target.value)} placeholder="0" />
      </div>
      <div className="form-group">
        <label className="form-label">Probability (0–100)</label>
        <input className="form-input" type="number" min="0" max="100" value={form.probability} onChange={e => set('probability', e.target.value)} placeholder="50" />
      </div>
      <div className="form-group">
        <label className="form-label">Expected Close Date</label>
        <input className="form-input" type="date" value={form.expected_close_date} onChange={e => set('expected_close_date', e.target.value)} />
      </div>
      <div className="form-group">
        <label className="form-label">Notes</label>
        <textarea className="form-input" rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Additional notes…" />
      </div>
    </>
  )
}
