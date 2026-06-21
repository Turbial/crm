import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Edit2, Save, X } from 'lucide-react'
import { get, patch, del } from '../../api'
import Spinner from '../../components/Spinner'
import Badge from '../../components/Badge'
import Timeline from '../../components/Timeline'

const FIELDS = [
  ['name', 'Company Name', 'text'],
  ['domain', 'Domain', 'text'],
  ['industry', 'Industry', 'text'],
  ['size', 'Size', 'text'],
  ['website', 'Website', 'text'],
]

export default function CompanyDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})

  const { data: company, isLoading } = useQuery({
    queryKey: ['company', id],
    queryFn: () => get(`/companies/${id}`),
  })

  const { data: leads = [] } = useQuery({
    queryKey: ['company-leads', id],
    queryFn: () => get(`/companies/${id}/leads`),
    enabled: !!company,
    retry: false,
  })

  const { data: contacts = [] } = useQuery({
    queryKey: ['company-contacts', id],
    queryFn: () => get(`/companies/${id}/contacts`),
    enabled: !!company,
    retry: false,
  })

  const { data: timeline = [] } = useQuery({
    queryKey: ['timeline', 'company', id],
    queryFn: () => get(`/companies/${id}/timeline`),
    enabled: !!company,
    retry: false,
  })

  const update = useMutation({
    mutationFn: body => patch(`/companies/${id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['company', id] }); setEditing(false) },
  })

  const remove = useMutation({
    mutationFn: () => del(`/companies/${id}`),
    onSuccess: () => navigate('/crm/companies'),
  })

  if (isLoading) return <Spinner />
  if (!company) return <p className="text-muted">Company not found.</p>

  function startEdit() {
    setForm({ name: company.name, domain: company.domain, industry: company.industry, size: company.size, website: company.website })
    setEditing(true)
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button className="btn btn-ghost btn-icon" onClick={() => navigate(-1)}><ArrowLeft size={16} /></button>
        <h1 style={{ fontSize: 20, fontWeight: 700, flex: 1 }}>{company.name}</h1>
        {!editing && (
          <button className="btn btn-secondary btn-sm flex gap-1 items-center" onClick={startEdit}>
            <Edit2 size={13} /> Edit
          </button>
        )}
      </div>

      <div className="two-col">
        <div className="card">
          <h3 className="font-semibold" style={{ fontSize: 14, marginBottom: 16 }}>Company Details</h3>

          {editing ? (
            <div>
              {FIELDS.map(([k, label, type]) => (
                <div key={k} className="form-group">
                  <label className="form-label">{label}</label>
                  <input className="form-input" type={type} value={form[k] || ''} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />
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
              {FIELDS.map(([k, label]) => (
                <div key={k} className="flex justify-between" style={{ fontSize: 13, padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                  <span className="font-medium">
                    {k === 'website' && company[k]
                      ? <a href={company[k]} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }} onClick={e => e.stopPropagation()}>{company[k]}</a>
                      : company[k] || '—'}
                  </span>
                </div>
              ))}
            </div>
          )}

          <button
            className="btn btn-danger btn-sm"
            style={{ marginTop: 24 }}
            onClick={() => { if (window.confirm(`Delete "${company.name}"?`)) remove.mutate() }}
          >
            Delete Company
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
              <h3 className="font-semibold" style={{ fontSize: 14, margin: 0 }}>Leads ({leads.length})</h3>
            </div>
            {leads.length === 0
              ? <p className="text-muted text-sm" style={{ padding: 16 }}>No leads linked.</p>
              : leads.map(l => (
                <div key={l.id} className="flex items-center justify-between" style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                  onClick={() => navigate(`/crm/leads/${l.id}`)}>
                  <div>
                    <div className="text-sm font-medium">{l.name}</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{l.email}</div>
                  </div>
                  <div className="flex gap-2 items-center">
                    <Badge label={l.status} />
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{l.score}</span>
                  </div>
                </div>
              ))}
          </div>

          {contacts.length > 0 && (
            <div className="card" style={{ padding: 0 }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                <h3 className="font-semibold" style={{ fontSize: 14, margin: 0 }}>Contacts ({contacts.length})</h3>
              </div>
              {contacts.map(c => (
                <div key={c.id} className="flex items-center justify-between" style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                  onClick={() => navigate(`/crm/contacts/${c.id}`)}>
                  <div>
                    <div className="text-sm font-medium">{c.name}</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{c.email || c.title}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="card">
            <h3 className="font-semibold" style={{ fontSize: 14, marginBottom: 16 }}>Activity Timeline</h3>
            <Timeline events={timeline} />
          </div>
        </div>
      </div>
    </div>
  )
}
