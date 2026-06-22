import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Settings as SettingsIcon, Plus, Trash2, Save, Key, Copy, Check, Eye, EyeOff, Sparkles, CheckCircle, XCircle, Loader, ShieldCheck } from 'lucide-react'
import { get, post, patch, del } from '../api'
import Spinner from '../components/Spinner'
import EmptyState from '../components/EmptyState'

const TABS = ['Organization', 'SLA Rules', 'Custom Fields', 'Members', 'API Keys', 'AI', 'Permissions']

export default function Settings() {
  const [tab, setTab] = useState('Organization')

  return (
    <div>
      <div className="page-header">
        <div><h1>Settings</h1><p>Manage your organization configuration</p></div>
      </div>

      <div className="flex gap-0" style={{ borderBottom: '1px solid var(--border-subtle)', marginBottom: 24 }}>
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="btn btn-ghost"
            style={{
              borderRadius: 0,
              borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
              color: tab === t ? 'var(--accent)' : 'var(--text-muted)',
              fontWeight: tab === t ? 600 : 400,
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Organization' && <OrgSettings />}
      {tab === 'SLA Rules' && <SLARules />}
      {tab === 'Custom Fields' && <CustomFields />}
      {tab === 'Members' && <Members />}
      {tab === 'API Keys' && <ApiKeys />}
      {tab === 'AI' && <AISettings />}
      {tab === 'Permissions' && <RecordPermissions />}
    </div>
  )
}

function OrgSettings() {
  const qc = useQueryClient()
  const { data: org, isLoading } = useQuery({
    queryKey: ['settings', 'org'],
    queryFn: () => get('/settings/org'),
  })
  const [form, setForm] = useState({})

  const save = useMutation({
    mutationFn: () => patch('/settings/org', form),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'org'] }),
  })

  if (isLoading) return <Spinner />

  const current = { ...org, ...form }

  return (
    <div className="card" style={{ maxWidth: 520 }}>
      <h3 style={{ marginTop: 0 }}>Organization</h3>
      <div className="form-group">
        <label>Name</label>
        <input className="form-input" defaultValue={org?.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
      </div>
      <div className="form-group">
        <label>Website</label>
        <input className="form-input" defaultValue={org?.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} />
      </div>
      <div className="form-group">
        <label>Industry</label>
        <input className="form-input" defaultValue={org?.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))} />
      </div>
      <div className="form-group">
        <label>Plan</label>
        <input className="form-input" value={org?.plan || 'starter'} readOnly style={{ color: 'var(--text-muted)' }} />
      </div>
      <button className="btn btn-primary flex gap-2 items-center" onClick={() => save.mutate()} disabled={save.isPending}>
        <Save size={14} /> Save changes
      </button>
      {save.isSuccess && <p style={{ color: 'var(--success)', marginTop: 8, fontSize: 13 }}>Saved.</p>}
    </div>
  )
}

function SLARules() {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ name: '', entity_type: 'lead', sla_hours: 24, action_on_breach: 'notify', escalate_via: 'notification' })
  const [editForm, setEditForm] = useState({})

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['settings', 'sla-rules'],
    queryFn: () => get('/settings/sla-rules'),
  })

  const create = useMutation({
    mutationFn: () => post('/settings/sla-rules', form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings', 'sla-rules'] })
      setShowAdd(false)
      setForm({ name: '', entity_type: 'lead', sla_hours: 24, action_on_breach: 'notify', escalate_via: 'notification' })
    },
  })

  const update = useMutation({
    mutationFn: ({ id, data }) => patch(`/settings/sla-rules/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['settings', 'sla-rules'] }); setEditId(null) },
  })

  const remove = useMutation({
    mutationFn: id => del(`/settings/sla-rules/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'sla-rules'] }),
  })

  if (isLoading) return <Spinner />

  function startEdit(r) {
    setEditId(r.id)
    setEditForm({ sla_hours: r.sla_hours, action_on_breach: r.action_on_breach, escalate_via: r.escalate_via })
  }

  return (
    <div>
      <div className="flex" style={{ justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="btn btn-primary flex gap-2 items-center" onClick={() => setShowAdd(true)}>
          <Plus size={14} /> Add Rule
        </button>
      </div>

      {showAdd && (
        <div className="card" style={{ marginBottom: 20, maxWidth: 480 }}>
          <h4 style={{ marginTop: 0 }}>New SLA Rule</h4>
          <div className="form-group">
            <label>Rule Name *</label>
            <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Lead follow-up SLA" autoFocus />
          </div>
          <div className="form-group">
            <label>Entity Type</label>
            <select className="form-input" value={form.entity_type} onChange={e => setForm(f => ({ ...f, entity_type: e.target.value }))}>
              <option value="lead">Lead</option>
              <option value="deal">Deal</option>
              <option value="contact">Contact</option>
            </select>
          </div>
          <div className="form-group">
            <label>SLA Hours</label>
            <input type="number" className="form-input" value={form.sla_hours} onChange={e => setForm(f => ({ ...f, sla_hours: Number(e.target.value) }))} min="1" />
          </div>
          <div className="form-group">
            <label>Action on Breach</label>
            <select className="form-input" value={form.action_on_breach} onChange={e => setForm(f => ({ ...f, action_on_breach: e.target.value }))}>
              <option value="notify">Notify</option>
              <option value="escalate">Escalate</option>
              <option value="auto_execute">Auto Execute</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-primary" onClick={() => create.mutate()} disabled={!form.name.trim() || create.isPending}>
              {create.isPending ? 'Creating…' : 'Create'}
            </button>
            <button className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
          {create.isError && <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 8 }}>{create.error?.message}</p>}
        </div>
      )}

      {rules.length === 0 && !showAdd
        ? <EmptyState icon={SettingsIcon} title="No SLA rules" description="Add rules to get notified when entities miss SLA thresholds." />
        : (
          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Name</th><th>Entity</th><th>SLA Hours</th><th>On Breach</th><th>Active</th><th></th></tr>
                </thead>
                <tbody>
                  {rules.map(r => (
                    <tr key={r.id}>
                      <td className="font-medium">{r.name}</td>
                      <td className="td-muted">{r.entity_type}</td>
                      <td>
                        {editId === r.id
                          ? <input type="number" className="form-input" value={editForm.sla_hours} onChange={e => setEditForm(f => ({ ...f, sla_hours: Number(e.target.value) }))} style={{ width: 80, padding: '3px 8px', fontSize: 13 }} />
                          : `${r.sla_hours}h`}
                      </td>
                      <td>
                        {editId === r.id
                          ? (
                            <select className="form-input" value={editForm.action_on_breach} onChange={e => setEditForm(f => ({ ...f, action_on_breach: e.target.value }))} style={{ fontSize: 12, padding: '3px 8px', width: 'auto' }}>
                              <option value="notify">notify</option>
                              <option value="escalate">escalate</option>
                              <option value="auto_execute">auto_execute</option>
                            </select>
                          )
                          : <span className="td-muted">{r.action_on_breach}</span>}
                      </td>
                      <td>
                        <span style={{ fontSize: 12, color: r.active ? 'var(--success)' : 'var(--text-muted)' }}>
                          {r.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-1">
                          {editId === r.id ? (
                            <>
                              <button className="btn btn-primary btn-sm" onClick={() => update.mutate({ id: r.id, data: editForm })} disabled={update.isPending} style={{ fontSize: 12 }}>Save</button>
                              <button className="btn btn-secondary btn-sm" onClick={() => setEditId(null)} style={{ fontSize: 12 }}>Cancel</button>
                            </>
                          ) : (
                            <button className="btn btn-ghost btn-sm" onClick={() => startEdit(r)} style={{ fontSize: 12 }}>Edit</button>
                          )}
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => remove.mutate(r.id)} disabled={remove.isPending}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
    </div>
  )
}

const FIELD_TYPES = ['text', 'number', 'date', 'boolean', 'select', 'textarea', 'url', 'email', 'phone']
const FIELD_ENTITIES = ['lead', 'contact', 'company', 'deal', 'project']

function CustomFields() {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ entity_type: 'lead', name: '', key: '', field_type: 'text', required: false, position: 1, active: true })

  const { data: fields = [], isLoading } = useQuery({
    queryKey: ['custom-fields'],
    queryFn: () => get('/custom-fields'),
  })

  const create = useMutation({
    mutationFn: () => post('/custom-fields', { ...form, options: form.field_type === 'select' ? [] : null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['custom-fields'] }); setShowAdd(false); setForm({ entity_type: 'lead', name: '', key: '', field_type: 'text', required: false, position: 1, active: true }) },
  })

  const remove = useMutation({
    mutationFn: id => del(`/custom-fields/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['custom-fields'] }),
  })

  if (isLoading) return <Spinner />

  function deriveKey(name) {
    return name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
  }

  return (
    <div>
      <div className="flex" style={{ justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="btn btn-primary flex gap-2 items-center" onClick={() => setShowAdd(true)}>
          <Plus size={14} /> Add Field
        </button>
      </div>

      {showAdd && (
        <div className="card" style={{ marginBottom: 20, maxWidth: 520 }}>
          <h4 style={{ marginTop: 0, marginBottom: 14 }}>New Custom Field</h4>
          <div className="two-col">
            <div className="form-group">
              <label className="form-label">Entity</label>
              <select className="form-input" value={form.entity_type} onChange={e => setForm(f => ({ ...f, entity_type: e.target.value }))}>
                {FIELD_ENTITIES.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Field Type</label>
              <select className="form-input" value={form.field_type} onChange={e => setForm(f => ({ ...f, field_type: e.target.value }))}>
                {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Label (display name)</label>
            <input
              className="form-input"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value, key: deriveKey(e.target.value) }))}
              placeholder="e.g. Customer Tier"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Key (API field name)</label>
            <input
              className="form-input"
              value={form.key}
              onChange={e => setForm(f => ({ ...f, key: deriveKey(e.target.value) }))}
              placeholder="e.g. customer_tier"
              style={{ fontFamily: 'monospace', fontSize: 13 }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <input type="checkbox" id="cf-required" checked={form.required} onChange={e => setForm(f => ({ ...f, required: e.target.checked }))} />
            <label htmlFor="cf-required" style={{ fontSize: 13, cursor: 'pointer' }}>Required field</label>
          </div>
          {create.isError && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 8 }}>{create.error?.message}</p>}
          <div className="flex gap-2">
            <button className="btn btn-primary" onClick={() => create.mutate()} disabled={!form.name.trim() || !form.key.trim() || create.isPending}>
              {create.isPending ? 'Creating…' : 'Create'}
            </button>
            <button className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
        </div>
      )}

      {fields.length === 0 && !showAdd ? (
        <EmptyState icon={SettingsIcon} title="No custom fields" description="Extend entity records with organization-specific fields." />
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Entity</th><th>Label</th><th>Key</th><th>Type</th><th>Required</th><th></th></tr>
              </thead>
              <tbody>
                {fields.map(f => (
                  <tr key={f.id}>
                    <td className="td-muted">{f.entity_type}</td>
                    <td className="font-medium">{f.name}</td>
                    <td><code style={{ fontSize: 11 }}>{f.key}</code></td>
                    <td className="td-muted">{f.field_type}</td>
                    <td className="td-muted">{f.required ? 'Yes' : 'No'}</td>
                    <td>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => remove.mutate(f.id)} disabled={remove.isPending}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

const ROLES = ['owner', 'manager', 'employee', 'agent']

function Members() {
  const qc = useQueryClient()
  const [showInvite, setShowInvite] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'employee' })

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['org', 'members'],
    queryFn: () => get('/organizations/me/members'),
  })

  const invite = useMutation({
    mutationFn: () => post('/organizations/me/members', form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org', 'members'] })
      setShowInvite(false)
      setForm({ name: '', email: '', password: '', role: 'employee' })
    },
  })

  const updateRole = useMutation({
    mutationFn: ({ id, role }) => patch(`/organizations/me/members/${id}`, { role }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org', 'members'] }),
  })

  if (isLoading) return <Spinner />

  return (
    <div>
      <div className="flex" style={{ justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="btn btn-primary flex gap-2 items-center" onClick={() => setShowInvite(true)}>
          <Plus size={14} /> Add Member
        </button>
      </div>

      {showInvite && (
        <div className="card" style={{ marginBottom: 20, maxWidth: 480 }}>
          <h4 style={{ marginTop: 0, marginBottom: 14 }}>Add Team Member</h4>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Jane Smith" autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="jane@acme.com" />
          </div>
          <div className="form-group">
            <label className="form-label">Temporary Password</label>
            <input className="form-input" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Min 10 characters" />
          </div>
          <div className="form-group">
            <label className="form-label">Role</label>
            <select className="form-input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          {invite.isError && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 8 }}>{invite.error?.message}</p>}
          <div className="flex gap-2">
            <button
              className="btn btn-primary"
              disabled={!form.name.trim() || !form.email.trim() || !form.password.trim() || invite.isPending}
              onClick={() => invite.mutate()}
            >
              {invite.isPending ? 'Adding…' : 'Add Member'}
            </button>
            <button className="btn btn-secondary" onClick={() => setShowInvite(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th></tr>
            </thead>
            <tbody>
              {members.map(m => (
                <tr key={m.id}>
                  <td className="font-medium">{m.name}</td>
                  <td className="td-muted">{m.email}</td>
                  <td>
                    <select
                      className="form-input"
                      value={m.role}
                      onChange={e => updateRole.mutate({ id: m.id, role: e.target.value })}
                      style={{ fontSize: 12, padding: '3px 8px', width: 'auto' }}
                    >
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td>
                    <span style={{ fontSize: 12, color: m.is_active ? 'var(--success)' : 'var(--text-muted)' }}>
                      {m.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

const ALL_SCOPES = [
  { value: 'leads:read',       label: 'Leads — read' },
  { value: 'leads:write',      label: 'Leads — write' },
  { value: 'deals:read',       label: 'Deals — read' },
  { value: 'deals:write',      label: 'Deals — write' },
  { value: 'contacts:read',    label: 'Contacts — read' },
  { value: 'contacts:write',   label: 'Contacts — write' },
  { value: 'companies:read',   label: 'Companies — read' },
  { value: 'companies:write',  label: 'Companies — write' },
  { value: 'actions:run',      label: 'Actions — run & list' },
  { value: 'memory:read',      label: 'Memory — read' },
  { value: 'memory:write',     label: 'Memory — write' },
  { value: 'analytics:read',   label: 'Analytics — read' },
]

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button className="btn btn-ghost btn-icon btn-sm" onClick={handleCopy} title="Copy">
      {copied ? <Check size={14} color="var(--success)" /> : <Copy size={14} />}
    </button>
  )
}

function RevealKey({ raw }) {
  const [show, setShow] = useState(false)
  return (
    <div className="flex items-center gap-1" style={{ fontFamily: 'monospace', fontSize: 13 }}>
      <span style={{ color: 'var(--accent)' }}>
        {show ? raw : raw.slice(0, 12) + '•'.repeat(20)}
      </span>
      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShow(s => !s)} title={show ? 'Hide' : 'Reveal'}>
        {show ? <EyeOff size={13} /> : <Eye size={13} />}
      </button>
      <CopyButton text={raw} />
    </div>
  )
}

function ApiKeys() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [newKey, setNewKey] = useState(null) // raw key shown once after creation
  const [form, setForm] = useState({ name: '', scopes: [], expires_at: '' })

  const { data: keys = [], isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => get('/api-keys'),
  })

  const create = useMutation({
    mutationFn: () => post('/api-keys', {
      name: form.name,
      scopes: form.scopes,
      expires_at: form.expires_at || null,
    }),
    onSuccess: (data) => {
      setNewKey(data.raw_key)
      setShowForm(false)
      setForm({ name: '', scopes: [], expires_at: '' })
      qc.invalidateQueries({ queryKey: ['api-keys'] })
    },
  })

  const revoke = useMutation({
    mutationFn: id => del(`/api-keys/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }),
  })

  function toggleScope(scope) {
    setForm(f => ({
      ...f,
      scopes: f.scopes.includes(scope) ? f.scopes.filter(s => s !== scope) : [...f.scopes, scope],
    }))
  }

  if (isLoading) return <Spinner />

  return (
    <div>
      {/* One-time key display */}
      {newKey && (
        <div className="card" style={{ marginBottom: 20, background: 'var(--accent-soft)', border: '1px solid var(--accent)' }}>
          <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
            <Key size={16} color="var(--accent)" />
            <strong style={{ color: 'var(--accent)' }}>API key created — copy it now, it won't be shown again</strong>
          </div>
          <RevealKey raw={newKey} />
          <div style={{ marginTop: 12 }}>
            <strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Usage:</strong>
            <code style={{ fontSize: 12, display: 'block', color: 'var(--text-muted)' }}>
              curl -H "X-API-Key: {newKey}" https://api.mightyops.io/agent/context
            </code>
            <code style={{ fontSize: 12, display: 'block', color: 'var(--text-muted)', marginTop: 4 }}>
              curl -H "Authorization: Bearer {newKey}" https://api.mightyops.io/agent/leads
            </code>
          </div>
          <button className="btn btn-secondary btn-sm" style={{ marginTop: 12 }} onClick={() => setNewKey(null)}>
            I've copied it, dismiss
          </button>
        </div>
      )}

      <div className="flex" style={{ justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="btn btn-primary flex gap-2 items-center" onClick={() => setShowForm(true)}>
          <Plus size={14} /> New API Key
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 20, maxWidth: 520 }}>
          <h4 style={{ marginTop: 0 }}>Create API Key</h4>
          <div className="form-group">
            <label>Name <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input
              className="form-input"
              placeholder="e.g. Prospecting Agent"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label>Scopes <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(leave all unchecked for full access)</span></label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', marginTop: 6 }}>
              {ALL_SCOPES.map(s => (
                <label key={s.value} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={form.scopes.includes(s.value)}
                    onChange={() => toggleScope(s.value)}
                  />
                  {s.label}
                </label>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Expires at <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
            <input
              type="datetime-local"
              className="form-input"
              value={form.expires_at}
              onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
            />
          </div>

          <div className="flex gap-2">
            <button
              className="btn btn-primary"
              onClick={() => create.mutate()}
              disabled={create.isPending || !form.name.trim()}
            >
              {create.isPending ? 'Creating…' : 'Create key'}
            </button>
            <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
          {create.isError && (
            <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 8 }}>{create.error?.message}</p>
          )}
        </div>
      )}

      {/* Docs callout */}
      <div className="card" style={{ marginBottom: 16, padding: '12px 16px', background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
          <strong>Agent endpoints:</strong>{' '}
          <code>/agent/context</code> · <code>/agent/leads</code> · <code>/agent/deals</code> ·{' '}
          <code>/agent/actions/run</code> · <code>/agent/memory/:key</code> · <code>/agent/analytics/summary</code>
          {' — '}pass your key as <code>X-API-Key</code> header or <code>Authorization: Bearer</code>.
          See <code>GET /agent/capabilities</code> for the full endpoint list and required scopes.
        </p>
      </div>

      {keys.length === 0 && !showForm
        ? <EmptyState icon={Key} title="No API keys" description="Create a key to give agents or external systems access to MightyOps." />
        : (
          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Name</th><th>Prefix</th><th>Scopes</th><th>Last used</th><th>Expires</th><th></th></tr>
                </thead>
                <tbody>
                  {keys.map(k => (
                    <tr key={k.id}>
                      <td className="font-medium">{k.name}</td>
                      <td><code style={{ fontSize: 12 }}>{k.key_prefix}…</code></td>
                      <td style={{ fontSize: 12 }}>
                        {k.scopes.length === 0
                          ? <span style={{ color: 'var(--text-muted)' }}>full access</span>
                          : k.scopes.join(', ')}
                      </td>
                      <td className="td-muted">{k.last_used_at ? new Date(k.last_used_at).toLocaleString() : '—'}</td>
                      <td className="td-muted">{k.expires_at ? new Date(k.expires_at).toLocaleDateString() : 'Never'}</td>
                      <td>
                        <button
                          className="btn btn-ghost btn-icon btn-sm"
                          title="Revoke"
                          onClick={() => { if (window.confirm(`Revoke key "${k.name}"?`)) revoke.mutate(k.id) }}
                          disabled={revoke.isPending}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
    </div>
  )
}


// ── AI / LLM Provider Settings ────────────────────────────────────────────────

const PROVIDER_META = {
  anthropic: { label: 'Anthropic (Claude)',         placeholder: 'sk-ant-api03-...', defaultModel: 'claude-sonnet-4-6', color: '#cc785c' },
  openai:    { label: 'OpenAI (GPT)',               placeholder: 'sk-...',            defaultModel: 'gpt-4o-mini',       color: '#10a37f' },
  deepseek:  { label: 'DeepSeek',                   placeholder: 'sk-...',            defaultModel: 'deepseek-chat',     color: '#4d6bfe' },
  google:    { label: 'Google (Gemini)',             placeholder: 'AI...',             defaultModel: 'gemini-1.5-flash',  color: '#4285f4' },
  custom:    { label: 'Custom (OpenAI-compatible)', placeholder: 'key...',            defaultModel: '',                  color: '#888'    },
}

function AISettings() {
  const qc = useQueryClient()
  const { data: llm, isLoading } = useQuery({
    queryKey: ['settings', 'llm'],
    queryFn: () => get('/settings/llm'),
  })
  const [edits, setEdits] = useState({})
  const [show, setShow] = useState({})
  const [testStatus, setTestStatus] = useState(null)
  const [testMsg, setTestMsg] = useState('')

  const save = useMutation({
    mutationFn: body => patch('/settings/llm', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['settings', 'llm'] }); setEdits({}) },
  })

  const allProviders = llm
    ? [...new Set([...Object.keys(PROVIDER_META), ...Object.keys(llm.providers || {})])]
    : Object.keys(PROVIDER_META)

  function getEdit(pname, field) { return edits[pname]?.[field] ?? '' }
  function setEdit(pname, field, value) {
    setEdits(e => ({ ...e, [pname]: { ...(e[pname] || {}), [field]: value } }))
  }

  function handleSave() {
    const providers = {}
    for (const [pname, fields] of Object.entries(edits)) {
      if (pname !== '_active' && Object.keys(fields).length > 0) providers[pname] = fields
    }
    save.mutate({
      active_provider: edits._active || undefined,
      providers: Object.keys(providers).length ? providers : undefined,
    })
  }

  async function handleTest() {
    setTestStatus('loading'); setTestMsg('')
    try {
      const r = await post('/settings/llm/test', {})
      setTestStatus('ok'); setTestMsg(r.response || 'OK')
    } catch (err) {
      setTestStatus('error'); setTestMsg(err.message || 'Connection failed')
    }
  }

  const hasEdits = Object.keys(edits).length > 0
  const activeProvider = edits._active ?? llm?.active_provider

  if (isLoading) return <Spinner />

  return (
    <div style={{ maxWidth: 720 }}>
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Active Provider</h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
          Configure one or more providers below. The active provider is used for AI features like project scoping.
        </p>
        <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
          {allProviders.map(pname => {
            const meta = PROVIDER_META[pname] || { label: pname, color: '#888' }
            const isActive = activeProvider === pname
            const isConfigured = llm?.providers?.[pname]?.configured
            return (
              <button
                key={pname}
                onClick={() => setEdits(e => ({ ...e, _active: pname }))}
                className="btn"
                style={{
                  border: `2px solid ${isActive ? meta.color : 'var(--border-subtle)'}`,
                  background: isActive ? `${meta.color}18` : 'transparent',
                  color: isActive ? meta.color : 'var(--text)',
                  fontWeight: isActive ? 600 : 400,
                  fontSize: 13,
                  gap: 6,
                }}
              >
                {isConfigured && <span style={{ color: '#22c55e', fontSize: 10 }}>●</span>}
                {meta.label}
                {isActive && ' ✓'}
              </button>
            )
          })}
        </div>
      </div>

      {allProviders.map(pname => {
        const meta = PROVIDER_META[pname] || { label: pname, placeholder: 'key...', defaultModel: '', color: '#888' }
        const current = llm?.providers?.[pname] || {}
        const isCustom = pname === 'custom'
        const showBaseUrl = isCustom || pname === 'openai'

        return (
          <div key={pname} className="card" style={{ marginBottom: 16, borderLeft: `3px solid ${meta.color}` }}>
            <div className="flex items-center gap-2 mb-3">
              <span style={{ fontSize: 13, fontWeight: 600 }}>{meta.label}</span>
              {current.configured && (
                <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: '#d4edda', color: '#155724' }}>Configured</span>
              )}
              {activeProvider === pname && (
                <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: `${meta.color}22`, color: meta.color }}>Active</span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">API Key</label>
              <div className="flex gap-2">
                <input
                  className="form-input"
                  type={show[pname] ? 'text' : 'password'}
                  placeholder={current.configured ? current.api_key_masked : meta.placeholder}
                  value={getEdit(pname, 'api_key')}
                  onChange={e => setEdit(pname, 'api_key', e.target.value)}
                  style={{ flex: 1, fontFamily: 'monospace', fontSize: 13 }}
                />
                <button className="btn btn-ghost btn-icon" onClick={() => setShow(s => ({ ...s, [pname]: !s[pname] }))}>
                  {show[pname] ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                {current.configured && (
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', fontSize: 12 }} onClick={() => setEdit(pname, 'api_key', '')}>
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Model</label>
              <input
                className="form-input"
                placeholder={current.model || meta.defaultModel || 'e.g. gpt-4o-mini'}
                value={getEdit(pname, 'model')}
                onChange={e => setEdit(pname, 'model', e.target.value)}
              />
            </div>

            {showBaseUrl && (
              <div className="form-group">
                <label className="form-label">Base URL{isCustom ? ' *' : ' (optional override)'}</label>
                <input
                  className="form-input"
                  placeholder={current.base_url || (isCustom ? 'https://your-endpoint/v1' : 'https://api.openai.com/v1')}
                  value={getEdit(pname, 'base_url')}
                  onChange={e => setEdit(pname, 'base_url', e.target.value)}
                />
                {isCustom && (
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    Works with Ollama, Groq, Together AI, LM Studio, or any OpenAI-compatible endpoint.
                  </p>
                )}
              </div>
            )}
          </div>
        )
      })}

      <div className="flex items-center gap-3 mt-4" style={{ flexWrap: 'wrap' }}>
        <button className="btn btn-primary" disabled={save.isPending || !hasEdits} onClick={handleSave}>
          {save.isPending ? 'Saving…' : 'Save Changes'}
        </button>
        <button className="btn btn-secondary flex gap-2 items-center" onClick={handleTest} disabled={testStatus === 'loading'}>
          <Sparkles size={13} /> Test Connection
        </button>
        {testStatus === 'ok' && (
          <span className="flex gap-1 items-center" style={{ fontSize: 13, color: '#22c55e' }}>
            <CheckCircle size={13} /> Connected — &ldquo;{testMsg}&rdquo;
          </span>
        )}
        {testStatus === 'error' && (
          <span className="flex gap-1 items-center" style={{ fontSize: 13, color: 'var(--danger)' }}>
            <XCircle size={13} /> {testMsg}
          </span>
        )}
        {save.isError && <span style={{ fontSize: 13, color: 'var(--danger)' }}>{save.error?.message}</span>}
      </div>

      <div className="card" style={{ marginTop: 24, background: 'var(--bg-surface)' }}>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
          <strong>Env var fallbacks:</strong> If no key is saved here, the system reads{' '}
          <code>ANTHROPIC_API_KEY</code>, <code>OPENAI_API_KEY</code>, <code>DEEPSEEK_API_KEY</code>,{' '}
          and <code>GOOGLE_API_KEY</code> from environment variables automatically. Keys saved here take precedence per organization.
        </p>
      </div>
    </div>
  )
}

const PERMISSION_BADGE_COLOR = { read: 'blue', write: 'green', deny: 'red' }
const ENTITY_TYPES = ['lead', 'contact', 'company', 'deal', 'project']

function RecordPermissions() {
  const qc = useQueryClient()
  const [entityType, setEntityType] = useState('')
  const [entityId, setEntityId] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [showGrant, setShowGrant] = useState(false)
  const [grantForm, setGrantForm] = useState({ user_id: '', field_key: '', permission: 'read' })

  const { data: perms = [], isLoading, refetch } = useQuery({
    queryKey: ['record-permissions', entityType, entityId],
    queryFn: () => get(`/record-permissions/${entityType}/${entityId}`),
    enabled: false,
    retry: false,
  })

  const grant = useMutation({
    mutationFn: () => post(`/record-permissions/${entityType}/${entityId}`, grantForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['record-permissions', entityType, entityId] })
      refetch()
      setShowGrant(false)
      setGrantForm({ user_id: '', field_key: '', permission: 'read' })
    },
  })

  const remove = useMutation({
    mutationFn: ({ userId, fieldKey }) => del(
      `/record-permissions/${entityType}/${entityId}?user_id=${encodeURIComponent(userId)}&field_key=${encodeURIComponent(fieldKey)}`
    ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['record-permissions', entityType, entityId] })
      refetch()
    },
  })

  function handleLoad() {
    if (!entityType || !entityId.trim()) return
    setLoaded(true)
    refetch()
  }

  const canLoad = entityType && entityId.trim()
  const showEmpty = !loaded || (!isLoading && perms.length === 0)

  return (
    <div>
      <div className="card" style={{ marginBottom: 20, maxWidth: 560 }}>
        <h3 style={{ marginTop: 0, fontSize: 15 }}>Lookup Record Permissions</h3>
        <div className="flex gap-2 items-end">
          <div className="form-group" style={{ marginBottom: 0, flex: '0 0 160px' }}>
            <label className="form-label">Entity Type</label>
            <select className="form-input" value={entityType} onChange={e => { setEntityType(e.target.value); setLoaded(false) }}>
              <option value="">— select —</option>
              {ENTITY_TYPES.map(et => <option key={et} value={et}>{et}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
            <label className="form-label">Entity ID</label>
            <input
              className="form-input"
              value={entityId}
              onChange={e => { setEntityId(e.target.value); setLoaded(false) }}
              placeholder="UUID or ID"
            />
          </div>
          <button className="btn btn-primary" disabled={!canLoad || isLoading} onClick={handleLoad}>
            {isLoading ? 'Loading…' : 'Load'}
          </button>
        </div>
      </div>

      {!loaded ? (
        <EmptyState
          icon={ShieldCheck}
          title="Load entity permissions first"
          description="Select an entity type and enter an entity ID above, then click Load."
        />
      ) : isLoading ? (
        <Spinner />
      ) : (
        <div>
          <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {perms.length} permission{perms.length !== 1 ? 's' : ''} for {entityType}/{entityId.slice(0, 8)}
            </span>
            <button className="btn btn-primary" onClick={() => setShowGrant(true)}>
              Grant Permission
            </button>
          </div>

          {perms.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="No permissions set"
              description="All users have default access. Grant explicit permissions below."
            />
          ) : (
            <div className="card" style={{ padding: 0 }}>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>User ID</th><th>Field Key</th><th>Permission</th><th>Granted By</th><th>Created</th><th></th></tr>
                  </thead>
                  <tbody>
                    {perms.map(p => (
                      <tr key={p.id}>
                        <td className="td-muted" style={{ fontFamily: 'monospace', fontSize: 12 }}>{p.user_id ? p.user_id.slice(0, 8) : '—'}</td>
                        <td><code style={{ fontSize: 12 }}>{p.field_key}</code></td>
                        <td><Badge label={p.permission} color={PERMISSION_BADGE_COLOR[p.permission] || 'gray'} /></td>
                        <td className="td-muted" style={{ fontFamily: 'monospace', fontSize: 12 }}>{p.granted_by_id ? p.granted_by_id.slice(0, 8) : '—'}</td>
                        <td className="td-muted">{p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}</td>
                        <td>
                          <button
                            className="btn btn-ghost btn-icon btn-sm"
                            onClick={() => {
                              if (window.confirm(`Remove permission for field "${p.field_key}"?`)) {
                                remove.mutate({ userId: p.user_id, fieldKey: p.field_key })
                              }
                            }}
                            disabled={remove.isPending}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {showGrant && (
        <div className="modal-overlay" onClick={() => setShowGrant(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2>Grant Permission</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowGrant(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">User ID *</label>
                <input
                  className="form-input"
                  autoFocus
                  value={grantForm.user_id}
                  onChange={e => setGrantForm(f => ({ ...f, user_id: e.target.value }))}
                  placeholder="User UUID"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Field Key *</label>
                <input
                  className="form-input"
                  value={grantForm.field_key}
                  onChange={e => setGrantForm(f => ({ ...f, field_key: e.target.value }))}
                  placeholder="e.g. email or * for all fields"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Permission</label>
                <select className="form-input" value={grantForm.permission} onChange={e => setGrantForm(f => ({ ...f, permission: e.target.value }))}>
                  <option value="read">read</option>
                  <option value="write">write</option>
                  <option value="deny">deny</option>
                </select>
              </div>
              {grant.isError && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{grant.error?.message}</p>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowGrant(false)}>Cancel</button>
              <button
                className="btn btn-primary"
                disabled={!grantForm.user_id.trim() || !grantForm.field_key.trim() || grant.isPending}
                onClick={() => grant.mutate()}
              >
                {grant.isPending ? 'Granting…' : 'Grant'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
