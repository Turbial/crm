import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Edit2, Save, X } from 'lucide-react'
import { get, patch, del } from '../../api'
import Spinner from '../../components/Spinner'
import Badge from '../../components/Badge'
import Timeline from '../../components/Timeline'

const STAGES = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost']

function fmt(n) {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export default function DealDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})

  const { data: deal, isLoading } = useQuery({
    queryKey: ['deal', id],
    queryFn: () => get(`/deals/${id}`),
  })

  const { data: timeline = [] } = useQuery({
    queryKey: ['timeline', 'deal', id],
    queryFn: () => get(`/timeline/deal/${id}`),
    enabled: !!deal,
    retry: false,
  })

  const update = useMutation({
    mutationFn: body => patch(`/deals/${id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['deal', id] }); setEditing(false) },
  })

  const remove = useMutation({
    mutationFn: () => del(`/deals/${id}`),
    onSuccess: () => navigate('/crm/deals'),
  })

  if (isLoading) return <Spinner />
  if (!deal) return <p className="text-muted">Deal not found.</p>

  function startEdit() {
    setForm({
      title: deal.title || deal.name,
      value: deal.value,
      currency: deal.currency || 'USD',
      stage: deal.stage || 'lead',
      probability: deal.probability,
      close_date: deal.close_date ? deal.close_date.slice(0, 10) : '',
      notes: deal.notes || '',
    })
    setEditing(true)
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button className="btn btn-ghost btn-icon" onClick={() => navigate(-1)}><ArrowLeft size={16} /></button>
        <h1 style={{ fontSize: 20, fontWeight: 700, flex: 1 }}>{deal.title || deal.name}</h1>
        <Badge label={deal.stage || 'lead'} />
        {!editing && (
          <button className="btn btn-secondary btn-sm flex gap-1 items-center" onClick={startEdit}>
            <Edit2 size={13} /> Edit
          </button>
        )}
      </div>

      <div className="two-col">
        <div className="card">
          <h3 className="font-semibold" style={{ fontSize: 14, marginBottom: 16 }}>Deal Details</h3>

          {editing ? (
            <div>
              <div className="form-group">
                <label className="form-label">Deal Name</label>
                <input className="form-input" value={form.title || ''} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Stage</label>
                <select className="form-input" value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value }))}>
                  {STAGES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Value</label>
                <input className="form-input" type="number" min="0" value={form.value || ''} onChange={e => setForm(f => ({ ...f, value: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Probability (%)</label>
                <input className="form-input" type="number" min="0" max="100" value={form.probability || ''} onChange={e => setForm(f => ({ ...f, probability: parseInt(e.target.value) || 0 }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Expected Close Date</label>
                <input className="form-input" type="date" value={form.close_date || ''} onChange={e => setForm(f => ({ ...f, close_date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-input" rows={3} value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ resize: 'vertical' }} />
              </div>
              <div className="flex gap-2">
                <button className="btn btn-primary btn-sm flex gap-1 items-center" disabled={update.isPending} onClick={() => update.mutate(form)}>
                  <Save size={13} /> {update.isPending ? 'Saving…' : 'Save'}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => setEditing(false)}><X size={13} /> Cancel</button>
              </div>
              {update.isError && <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 8 }}>{update.error?.message}</p>}
            </div>
          ) : (
            <div>
              {[
                ['Value', fmt(deal.value)],
                ['Currency', deal.currency || 'USD'],
                ['Stage', deal.stage],
                ['Probability', deal.probability != null ? `${deal.probability}%` : '—'],
                ['Close Date', deal.close_date ? new Date(deal.close_date).toLocaleDateString() : '—'],
                ['Created', new Date(deal.created_at).toLocaleDateString()],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between" style={{ fontSize: 13, padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                  <span className="font-medium">{val || '—'}</span>
                </div>
              ))}
              {deal.lead_id && (
                <div className="flex justify-between" style={{ fontSize: 13, padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Lead</span>
                  <Link to={`/crm/leads/${deal.lead_id}`} style={{ color: 'var(--accent)', fontSize: 13 }}>
                    {deal.lead_id.slice(0, 8)}…
                  </Link>
                </div>
              )}
              {deal.contact_id && (
                <div className="flex justify-between" style={{ fontSize: 13, padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Contact</span>
                  <Link to={`/crm/contacts/${deal.contact_id}`} style={{ color: 'var(--accent)', fontSize: 13 }}>
                    {deal.contact_id.slice(0, 8)}…
                  </Link>
                </div>
              )}
              {deal.company_id && (
                <div className="flex justify-between" style={{ fontSize: 13, padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Company</span>
                  <Link to={`/crm/companies/${deal.company_id}`} style={{ color: 'var(--accent)', fontSize: 13 }}>
                    {deal.company_id.slice(0, 8)}…
                  </Link>
                </div>
              )}
              {deal.notes && (
                <div style={{ marginTop: 12, fontSize: 13 }}>
                  <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>Notes</div>
                  <p style={{ margin: 0, lineHeight: 1.5 }}>{deal.notes}</p>
                </div>
              )}
            </div>
          )}

          <button
            className="btn btn-danger btn-sm"
            style={{ marginTop: 24 }}
            onClick={() => { if (window.confirm(`Delete "${deal.title || deal.name}"?`)) remove.mutate() }}
          >
            Delete Deal
          </button>
        </div>

        <div className="card">
          <h3 className="font-semibold" style={{ fontSize: 14, marginBottom: 16 }}>Activity Timeline</h3>
          <Timeline events={timeline} />
        </div>
      </div>
    </div>
  )
}
