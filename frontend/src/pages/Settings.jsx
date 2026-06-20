import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Settings as SettingsIcon, Plus, Trash2, Save, Key, Copy, Check, Eye, EyeOff, Sparkles, CheckCircle, XCircle, Loader } from 'lucide-react'
import { get, post, patch, del } from '../api'
import Spinner from '../components/Spinner'
import EmptyState from '../components/EmptyState'

const TABS = ['Organization', 'SLA Rules', 'Custom Fields', 'Members', 'API Keys', 'AI']

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
