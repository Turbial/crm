import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Edit2, Save, X } from 'lucide-react'
import { get, patch, del } from '../../api'
import Spinner from '../../components/Spinner'
import Badge from '../../components/Badge'
import Timeline from '../../components/Timeline'

const STATUSES = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost']

const EDIT_FIELDS = [
  ['name', 'Name', 'text'],
  ['email', 'Email', 'email'],
  ['phone', 'Phone', 'text'],
  ['company', 'Company', 'text'],
  ['source', 'Source', 'text'],
  ['score', 'Score', 'number'],
  ['city', 'City', 'text'],
  ['state', 'State', 'text'],
  ['website', 'Website', 'text'],
]

export default function LeadDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})

  const { data: lead, isLoading } = useQuery({ queryKey: ['lead', id], queryFn: () => get(`/leads/${id}`) })
  const { data: timeline = [] } = useQuery({ queryKey: ['timeline', 'lead', id], queryFn: () => get(`/timeline/lead/${id}`), retry: false })

  const update = useMutation({
    mutationFn: body => patch(`/leads/${id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lead', id] }); setEditing(false) },
  })

  const remove = useMutation({
    mutationFn: () => del(`/leads/${id}`),
    onSuccess: () => navigate('/crm/leads'),
  })

  if (isLoading) return <Spinner />
  if (!lead) return <p className="text-muted">Lead not found.</p>

  function startEdit() {
    setForm({ name: lead.name, email: lead.email, phone: lead.phone, company: lead.company, source: lead.source, score: lead.score, city: lead.city, state: lead.state, website: lead.website, status: lead.status })
    setEditing(true)
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button className="btn btn-ghost btn-icon" onClick={() => navigate(-1)}><ArrowLeft size={16} /></button>
        <h1 style={{ fontSize: 20, fontWeight: 700, flex: 1 }}>{lead.name}</h1>
        <Badge label={lead.status} />
        {!editing && (
          <button className="btn btn-secondary btn-sm flex gap-1 items-center" onClick={startEdit}>
            <Edit2 size={13} /> Edit
          </button>
        )}
      </div>

      <div className="two-col">
        <div className="card flex-col gap-3">
          <h3 className="font-semibold" style={{ fontSize: 14, marginBottom: 8 }}>Details</h3>

          {editing ? (
            <div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>
              {EDIT_FIELDS.map(([k, label, type]) => (
                <div key={k} className="form-group">
                  <label className="form-label">{label}</label>
                  <input className="form-input" type={type} value={form[k] ?? ''} onChange={e => setForm(f => ({ ...f, [k]: type === 'number' ? Number(e.target.value) : e.target.value }))} />
                </div>
              ))}
              <div className="flex gap-2 mt-4">
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
                ['Company', lead.company],
                ['Email', lead.email],
                ['Phone', lead.phone],
                ['Source', lead.source],
                ['Score', lead.score],
                ['City', lead.city],
                ['State', lead.state],
                ['Website', lead.website],
                ['Created', lead.created_at ? new Date(lead.created_at).toLocaleDateString() : null],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between" style={{ fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span className="text-muted">{label}</span>
                  <span className="font-medium">{val ?? '—'}</span>
                </div>
              ))}

              <div className="form-group mt-4">
                <label className="form-label">Quick Status Update</label>
                <select className="form-input" value={lead.status} onChange={e => update.mutate({ status: e.target.value })}>
                  {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>

              <button
                className="btn btn-danger btn-sm"
                style={{ marginTop: 8 }}
                onClick={() => { if (window.confirm('Delete lead?')) remove.mutate() }}
              >
                Delete Lead
              </button>
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="font-semibold" style={{ fontSize: 14, marginBottom: 16 }}>Activity Timeline</h3>
          <Timeline events={timeline} />
        </div>
      </div>
    </div>
  )
}
