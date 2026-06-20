import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Settings as SettingsIcon, Plus, Trash2, Save } from 'lucide-react'
import { get, post, patch, del } from '../api'
import Spinner from '../components/Spinner'
import EmptyState from '../components/EmptyState'

const TABS = ['Organization', 'SLA Rules', 'Custom Fields', 'Members']

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
  const [form, setForm] = useState({ entity_type: 'lead', field_name: 'updated_at', threshold_hours: 24, risk_level: 'medium', action_type: 'notify' })

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['settings', 'sla-rules'],
    queryFn: () => get('/settings/sla-rules'),
  })

  const create = useMutation({
    mutationFn: () => post('/settings/sla-rules', form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['settings', 'sla-rules'] }); setShowAdd(false) },
  })

  const remove = useMutation({
    mutationFn: id => del(`/settings/sla-rules/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'sla-rules'] }),
  })

  if (isLoading) return <Spinner />

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
            <label>Entity Type</label>
            <select className="form-input" value={form.entity_type} onChange={e => setForm(f => ({ ...f, entity_type: e.target.value }))}>
              <option value="lead">Lead</option>
              <option value="deal">Deal</option>
              <option value="contact">Contact</option>
            </select>
          </div>
          <div className="form-group">
            <label>Field Name</label>
            <input className="form-input" value={form.field_name} onChange={e => setForm(f => ({ ...f, field_name: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Threshold (hours)</label>
            <input type="number" className="form-input" value={form.threshold_hours} onChange={e => setForm(f => ({ ...f, threshold_hours: Number(e.target.value) }))} />
          </div>
          <div className="form-group">
            <label>Risk Level</label>
            <select className="form-input" value={form.risk_level} onChange={e => setForm(f => ({ ...f, risk_level: e.target.value }))}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-primary" onClick={() => create.mutate()} disabled={create.isPending}>Create</button>
            <button className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
        </div>
      )}

      {rules.length === 0 && !showAdd
        ? <EmptyState icon={SettingsIcon} title="No SLA rules" description="Add rules to get notified when entities miss SLA thresholds." />
        : (
          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Entity</th><th>Field</th><th>Threshold</th><th>Risk</th><th>Action</th><th></th></tr>
                </thead>
                <tbody>
                  {rules.map(r => (
                    <tr key={r.id}>
                      <td>{r.entity_type}</td>
                      <td>{r.field_name}</td>
                      <td>{r.threshold_hours}h</td>
                      <td><span className={`badge badge-${r.risk_level === 'critical' ? 'red' : r.risk_level === 'high' ? 'orange' : 'blue'}`}>{r.risk_level}</span></td>
                      <td>{r.action_type}</td>
                      <td>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => remove.mutate(r.id)} disabled={remove.isPending}>
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

function CustomFields() {
  const { data: fields = [], isLoading } = useQuery({
    queryKey: ['custom-fields'],
    queryFn: () => get('/custom-fields'),
  })

  if (isLoading) return <Spinner />

  return (
    <div>
      {fields.length === 0
        ? <EmptyState icon={SettingsIcon} title="No custom fields" description="Custom fields let you extend entity records with organization-specific data." />
        : (
          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Entity</th><th>Label</th><th>Type</th><th>Required</th></tr>
                </thead>
                <tbody>
                  {fields.map(f => (
                    <tr key={f.id}>
                      <td>{f.entity_type}</td>
                      <td>{f.label}</td>
                      <td>{f.field_type}</td>
                      <td>{f.is_required ? 'Yes' : 'No'}</td>
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

function Members() {
  const { data: org, isLoading } = useQuery({
    queryKey: ['org'],
    queryFn: () => get('/organizations/me'),
  })
  const { data: members = [], isLoading: loadingMembers } = useQuery({
    queryKey: ['org', 'members'],
    queryFn: () => get('/organizations/me/members'),
    enabled: !!org,
  })

  if (isLoading || loadingMembers) return <Spinner />

  return (
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
                <td>{m.role}</td>
                <td>{m.is_active ? 'Active' : 'Inactive'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
