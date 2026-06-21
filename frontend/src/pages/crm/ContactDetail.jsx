import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Edit2, Save, X } from 'lucide-react'
import { get, patch, del } from '../../api'
import Spinner from '../../components/Spinner'
import Badge from '../../components/Badge'
import Timeline from '../../components/Timeline'

const FIELDS = [
  ['name', 'Name', 'text'],
  ['email', 'Email', 'email'],
  ['phone', 'Phone', 'text'],
  ['title', 'Title', 'text'],
]

export default function ContactDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})

  const { data: contact, isLoading } = useQuery({
    queryKey: ['contact', id],
    queryFn: () => get(`/contacts/${id}`),
  })

  const { data: timeline = [] } = useQuery({
    queryKey: ['timeline', 'contact', id],
    queryFn: () => get(`/timeline/contact/${id}`),
    enabled: !!contact,
    retry: false,
  })

  const { data: linkedLead } = useQuery({
    queryKey: ['lead', contact?.lead_id],
    queryFn: () => get(`/leads/${contact.lead_id}`),
    enabled: !!contact?.lead_id,
    retry: false,
  })

  const update = useMutation({
    mutationFn: body => patch(`/contacts/${id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contact', id] }); setEditing(false) },
  })

  const remove = useMutation({
    mutationFn: () => del(`/contacts/${id}`),
    onSuccess: () => navigate('/crm/contacts'),
  })

  if (isLoading) return <Spinner />
  if (!contact) return <p className="text-muted">Contact not found.</p>

  function startEdit() { setForm({ name: contact.name, email: contact.email, phone: contact.phone, title: contact.title }); setEditing(true) }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button className="btn btn-ghost btn-icon" onClick={() => navigate(-1)}><ArrowLeft size={16} /></button>
        <h1 style={{ fontSize: 20, fontWeight: 700, flex: 1 }}>{contact.name}</h1>
        {!editing && (
          <button className="btn btn-secondary btn-sm flex gap-1 items-center" onClick={startEdit}>
            <Edit2 size={13} /> Edit
          </button>
        )}
      </div>

      <div className="two-col">
        <div className="card">
          <h3 className="font-semibold" style={{ fontSize: 14, marginBottom: 16 }}>Contact Details</h3>

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
                  <span className="font-medium">{contact[k] || '—'}</span>
                </div>
              ))}
              <div className="flex justify-between" style={{ fontSize: 13, padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Created</span>
                <span className="font-medium">{new Date(contact.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          )}

          <button
            className="btn btn-danger btn-sm"
            style={{ marginTop: 24 }}
            onClick={() => { if (window.confirm(`Delete "${contact.name}"?`)) remove.mutate() }}
          >
            Delete Contact
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {linkedLead && (
            <div className="card" style={{ padding: 0 }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                <h3 className="font-semibold" style={{ fontSize: 14, margin: 0 }}>Linked Lead</h3>
              </div>
              <div
                className="flex items-center justify-between"
                style={{ padding: '10px 16px', cursor: 'pointer' }}
                onClick={() => navigate(`/crm/leads/${linkedLead.id}`)}
              >
                <div>
                  <div className="font-medium text-sm">{linkedLead.name}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{linkedLead.company}</div>
                </div>
                <Badge label={linkedLead.status} />
              </div>
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
