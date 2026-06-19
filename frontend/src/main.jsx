import React, { useEffect, useState, useCallback } from 'react'
import { createRoot } from 'react-dom/client'
import './style.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// ── Small helpers ─────────────────────────────────────────────────────────────

function useApi(token) {
  const headers = token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' }

  const get = useCallback((path, params) => {
    let url = `${API}${path}`
    if (params) {
      const qs = Object.entries(params).filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
      if (qs) url += `?${qs}`
    }
    return fetch(url, { headers }).then(r => r.ok ? r.json() : Promise.reject(r))
  }, [token]) // eslint-disable-line

  const post = useCallback((path, body) =>
    fetch(`${API}${path}`, { method: 'POST', headers, body: body ? JSON.stringify(body) : undefined })
      .then(r => r.ok ? (r.status === 204 ? null : r.json()) : Promise.reject(r)),
  [token]) // eslint-disable-line

  return { get, post }
}

function Badge({ label, color = '#6b7280' }) {
  return (
    <span style={{ background: color + '22', color, fontSize: 11, padding: '2px 8px', borderRadius: 99, fontWeight: 600 }}>
      {label}
    </span>
  )
}

function statusColor(s) {
  if (!s) return '#6b7280'
  if (['completed', 'won', 'resolved', 'delivered'].includes(s)) return '#16a34a'
  if (['failed', 'lost'].includes(s)) return '#dc2626'
  if (['pending', 'new', 'generated'].includes(s)) return '#2563eb'
  if (['running', 'open'].includes(s)) return '#d97706'
  return '#6b7280'
}

// ── Tabs ───────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'command', label: 'AI Command' },
  { id: 'kanban', label: 'Kanban' },
  { id: 'supervisor', label: 'Supervisor' },
  { id: 'brief', label: 'Daily Brief' },
  { id: 'duplicates', label: 'Duplicates' },
  { id: 'leads', label: 'Leads' },
  { id: 'resources', label: 'Resources' },
]

// ── Supervisor panel ───────────────────────────────────────────────────────────

function SupervisorPanel({ api }) {
  const [stats, setStats] = useState(null)
  const [stuck, setStuck] = useState([])
  const [overdue, setOverdue] = useState([])
  const [inactive, setInactive] = useState([])
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState(null)

  const load = useCallback(async () => {
    const [s, st, ov, ia] = await Promise.allSettled([
      api.get('/supervisor/stats'),
      api.get('/supervisor/stuck'),
      api.get('/supervisor/overdue-approvals'),
      api.get('/supervisor/inactive-leads'),
    ])
    if (s.status === 'fulfilled') setStats(s.value)
    if (st.status === 'fulfilled') setStuck(Array.isArray(st.value) ? st.value : [])
    if (ov.status === 'fulfilled') setOverdue(Array.isArray(ov.value) ? ov.value : [])
    if (ia.status === 'fulfilled') setInactive(Array.isArray(ia.value) ? ia.value : [])
  }, [api])

  useEffect(() => { load() }, [load])

  async function scan() {
    setScanning(true)
    try {
      const r = await api.post('/supervisor/scan')
      setScanResult(r)
      await load()
    } catch { setScanResult({ error: 'Scan failed' }) }
    setScanning(false)
  }

  return (
    <div className="phase3Panel">
      <div className="panelHeader">
        <h2>Agent Supervisor</h2>
        <button onClick={scan} disabled={scanning}>{scanning ? 'Scanning…' : 'Run Scan'}</button>
      </div>
      {scanResult && (
        <div className="toast">{scanResult.error || `Escalated ${scanResult.escalated ?? 0} items`}</div>
      )}
      {stats && (
        <div className="statGrid">
          {Object.entries(stats).map(([k, v]) => (
            <div className="statCard" key={k}>
              <span>{k.replace(/_/g, ' ')}</span>
              <strong style={{ color: k === 'failed' || k === 'stuck' ? '#dc2626' : k === 'completed' ? '#16a34a' : undefined }}>
                {String(v)}
              </strong>
            </div>
          ))}
        </div>
      )}
      <div className="columns3">
        <div>
          <h3>Stuck Runs ({stuck.length})</h3>
          {stuck.length === 0 ? <p className="empty">All clear</p> : stuck.map(r => (
            <div className="listItem" key={r.id}>
              <b>{r.action_key}</b> <Badge label={r.status} color={statusColor(r.status)} />
              <small style={{ display: 'block' }}>{r.id.slice(0, 8)} · {new Date(r.created_at).toLocaleDateString()}</small>
            </div>
          ))}
        </div>
        <div>
          <h3>Overdue Approvals ({overdue.length})</h3>
          {overdue.length === 0 ? <p className="empty">None overdue</p> : overdue.map(a => (
            <div className="listItem" key={a.id}>
              <b>Approval {a.id.slice(0, 8)}</b> <Badge label={a.status} color="#d97706" />
              <small style={{ display: 'block' }}>Expires {a.expires_at ? new Date(a.expires_at).toLocaleDateString() : '—'}</small>
            </div>
          ))}
        </div>
        <div>
          <h3>Inactive Leads ({inactive.length})</h3>
          {inactive.length === 0 ? <p className="empty">No inactive leads</p> : inactive.map(l => (
            <div className="listItem" key={l.id}>
              <b>{l.name}</b> <Badge label={l.status} color={statusColor(l.status)} />
              <small style={{ display: 'block' }}>score {l.score}</small>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Daily Brief panel ──────────────────────────────────────────────────────────

const SECTION_ICONS = {
  tasks_due_today: '📋', overdue_tasks: '⚠️', pending_approvals: '✅',
  hot_leads: '🔥', blocked_projects: '🚫', revenue_snapshot: '💰', agent_health: '🤖',
}

function DailyBriefPanel({ api }) {
  const [brief, setBrief] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    try { setBrief(await api.get('/daily-brief/latest')) } catch { setBrief(null) }
  }, [api])

  useEffect(() => { load() }, [load])

  async function generate() {
    setLoading(true); setError(null)
    try { setBrief(await api.post('/daily-brief/generate')) }
    catch { setError('Generation failed — check manager permissions') }
    setLoading(false)
  }

  return (
    <div className="phase3Panel">
      <div className="panelHeader">
        <h2>Daily Brief</h2>
        <button onClick={generate} disabled={loading}>{loading ? 'Generating…' : 'Generate Now'}</button>
      </div>
      {error && <div className="toast error">{error}</div>}
      {!brief
        ? <p className="empty">No brief yet. Click "Generate Now" to create one.</p>
        : (
          <>
            <div style={{ marginBottom: 12 }}>
              <Badge label={brief.status} color={statusColor(brief.status)} />
              <span style={{ color: '#6b7280', fontSize: 13, marginLeft: 10 }}>
                {new Date(brief.brief_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            </div>
            {brief.summary_text && <p style={{ color: '#374151', marginBottom: 16 }}>{brief.summary_text}</p>}
            <div className="briefSections">
              {Object.entries(brief.sections || {}).map(([key, val]) => (
                <div className="briefSection" key={key}>
                  <h4>{SECTION_ICONS[key] || '•'} {key.replace(/_/g, ' ')}</h4>
                  {Array.isArray(val)
                    ? val.length === 0
                      ? <p className="empty">None</p>
                      : val.map((item, i) => (
                        <div className="listItem" key={i}>
                          {typeof item === 'object'
                            ? Object.entries(item).map(([k, v]) => <span key={k}><b>{k}:</b> {String(v)} </span>)
                            : String(item)}
                        </div>
                      ))
                    : typeof val === 'object'
                      ? <pre style={{ margin: 0, fontSize: 12 }}>{JSON.stringify(val, null, 2)}</pre>
                      : <strong>{String(val)}</strong>}
                </div>
              ))}
            </div>
          </>
        )}
    </div>
  )
}

// ── Duplicates panel ───────────────────────────────────────────────────────────

function DuplicatesPanel({ api }) {
  const [candidates, setCandidates] = useState([])
  const [entityType, setEntityType] = useState('')
  const [scanning, setScanning] = useState(false)

  const load = useCallback(async () => {
    try {
      const params = { status: 'pending', ...(entityType ? { entity_type: entityType } : {}) }
      const data = await api.get('/duplicates', params)
      setCandidates(Array.isArray(data) ? data : [])
    } catch { setCandidates([]) }
  }, [api, entityType])

  useEffect(() => { load() }, [load])

  async function dismiss(id) {
    await api.post(`/duplicates/${id}/dismiss`)
    await load()
  }

  async function merge(a, b) {
    if (!window.confirm(`Merge ${b.slice(0, 8)} into ${a.slice(0, 8)}?`)) return
    setScanning(true)
    try {
      await api.post(`/duplicates/merge-leads?keep_id=${encodeURIComponent(a)}&merge_id=${encodeURIComponent(b)}`)
      await load()
    } catch { alert('Merge failed — check manager permissions') }
    setScanning(false)
  }

  return (
    <div className="phase3Panel">
      <div className="panelHeader">
        <h2>Duplicate Candidates</h2>
        <select value={entityType} onChange={e => setEntityType(e.target.value)} style={{ minWidth: 140 }}>
          <option value="">All types</option>
          <option value="lead">Leads</option>
          <option value="contact">Contacts</option>
          <option value="company">Companies</option>
        </select>
      </div>
      {candidates.length === 0
        ? <p className="empty">No pending duplicate candidates.</p>
        : (
          <table className="dupTable">
            <thead>
              <tr><th>Type</th><th>Entity A</th><th>Entity B</th><th>Score</th><th>Matched</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {candidates.map(c => (
                <tr key={c.id}>
                  <td><Badge label={c.entity_type} color="#7c3aed" /></td>
                  <td><code>{c.entity_id_a.slice(0, 10)}</code></td>
                  <td><code>{c.entity_id_b.slice(0, 10)}</code></td>
                  <td><strong style={{ color: c.score >= 0.95 ? '#dc2626' : '#d97706' }}>{(c.score * 100).toFixed(0)}%</strong></td>
                  <td style={{ fontSize: 12 }}>{(c.matched_fields || []).join(', ')}</td>
                  <td>
                    <button className="sm" onClick={() => dismiss(c.id)}>Dismiss</button>
                    {c.entity_type === 'lead' && (
                      <button className="sm danger" disabled={scanning} onClick={() => merge(c.entity_id_a, c.entity_id_b)}>
                        Merge→A
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
    </div>
  )
}

// ── Main App ───────────────────────────────────────────────────────────────────

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '')
  const [email, setEmail] = useState('owner@mightymax.ai')
  const [password, setPassword] = useState('mighty123')
  const [tab, setTab] = useState('command')

  const [overview, setOverview] = useState(null)
  const [pmOverview, setPmOverview] = useState(null)
  const [workload, setWorkload] = useState([])
  const [leads, setLeads] = useState([])
  const [resources, setResources] = useState([])
  const [selected, setSelected] = useState('projects')
  const [rows, setRows] = useState([])
  const [projects, setProjects] = useState([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [kanban, setKanban] = useState(null)
  const [command, setCommand] = useState('Show Kanban board')
  const [threadId, setThreadId] = useState(null)
  const [messages, setMessages] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [dryRun, setDryRun] = useState(false)

  const headers = token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' }
  const api = useApi(token)

  async function login(e) {
    e?.preventDefault()
    const res = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
    const data = await res.json()
    if (data.access_token) { localStorage.setItem('token', data.access_token); setToken(data.access_token) }
    else alert(JSON.stringify(data))
  }

  async function load() {
    if (!token) return
    const [o, pm, w, l, r, t, p] = await Promise.all([
      fetch(`${API}/enterprise/overview`, { headers }).then(r => r.json()),
      fetch(`${API}/pm/executive-overview`, { headers }).then(r => r.json()).catch(() => null),
      fetch(`${API}/pm/workload`, { headers }).then(r => r.json()).catch(() => ({ items: [] })),
      fetch(`${API}/leads`, { headers }).then(r => r.json()),
      fetch(`${API}/enterprise/resources`, { headers }).then(r => r.json()),
      fetch(`${API}/messenger/threads`, { headers }).then(r => r.json()).catch(() => []),
      fetch(`${API}/projects`, { headers }).then(r => r.json()).catch(() => []),
    ])
    setOverview(o); setPmOverview(pm); setWorkload(w.items || []); setLeads(l); setResources(r.resources || []); setProjects(p || [])
    const firstThread = t?.[0]
    if (firstThread && !threadId) { setThreadId(firstThread.id); loadMessages(firstThread.id) }
    if ((p || []).length && !selectedProjectId) setSelectedProjectId(p[0].id)
  }

  async function loadMessages(id = threadId) {
    if (!id) return
    const data = await fetch(`${API}/messenger/threads/${id}/messages`, { headers }).then(r => r.json())
    setMessages(data)
  }

  async function loadResource(name = selected) {
    if (!token) return
    const data = await fetch(`${API}/enterprise/${name}`, { headers }).then(r => r.json()).catch(() => [])
    setRows(Array.isArray(data) ? data : []); setSelected(name)
  }

  async function loadKanban(id = selectedProjectId) {
    if (!id) return
    const data = await fetch(`${API}/projects/${id}/kanban`, { headers }).then(r => r.json())
    setKanban(data)
  }

  async function sendCommand(text = command) {
    if (!text.trim()) return
    const res = await fetch(`${API}/messenger/command`, { method: 'POST', headers, body: JSON.stringify({ text, thread_id: threadId, channel: 'web', dry_run: dryRun }) })
    const data = await res.json()
    setThreadId(data.thread.id)
    setMessages(prev => [...prev, data.user_message, data.assistant_message])
    setSuggestions(data.suggestions || [])
    setCommand('')
    await load()
    setTimeout(() => loadKanban(), 150)
  }

  async function moveTask(taskId, columnKey) {
    if (!selectedProjectId) return
    await fetch(`${API}/projects/${selectedProjectId}/kanban/tasks/${taskId}/move`, { method: 'PATCH', headers, body: JSON.stringify({ column_key: columnKey }) })
    await loadKanban(selectedProjectId)
  }

  async function queueTask(task) {
    if (!selectedProjectId) return
    await fetch(`${API}/projects/${selectedProjectId}/tasks/${task.id}/queue-openclaw`, { method: 'POST', headers })
    await sendCommand(`Task ${task.id.slice(0, 8)} queued to OpenClaw`)
  }

  useEffect(() => { load() }, [token]) // eslint-disable-line
  useEffect(() => { if (token) loadResource(selected) }, [token, selected]) // eslint-disable-line
  useEffect(() => { if (token && selectedProjectId) loadKanban(selectedProjectId) }, [token, selectedProjectId]) // eslint-disable-line

  if (!token) return (
    <main className="login">
      <h1>Mighty CRM Command Center</h1>
      <p>AI-first CRM + PM controlled by text messenger.</p>
      <form onSubmit={login}>
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" />
        <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="Password" />
        <button>Login</button>
      </form>
    </main>
  )

  const cards = overview ? Object.entries(overview) : []

  return (
    <main>
      <header>
        <div><h1>Mighty CRM + PM Command Center</h1><p>AI-native operations platform.</p></div>
        <button onClick={() => { localStorage.removeItem('token'); setToken('') }}>Logout</button>
      </header>

      <section className="grid">
        {cards.map(([k, v]) => <article className="card" key={k}><span>{k.replaceAll('_', ' ')}</span><strong>{String(v)}</strong></article>)}
        {pmOverview && Object.entries(pmOverview).filter(([, v]) => typeof v !== 'object').map(([k, v]) => (
          <article className="card pm" key={'pm-' + k}><span>PM {k.replaceAll('_', ' ')}</span><strong>{String(v)}</strong></article>
        ))}
      </section>

      <div className="tabBar">
        {TABS.map(t => <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>{t.label}</button>)}
      </div>

      {tab === 'command' && (
        <section className="commandShell">
          <div className="chat">
            <h2>Mighty PM Messenger Bot</h2>
            <div className="messages">
              {messages.map(m => <div className={`bubble ${m.sender_type}`} key={m.id}><b>{m.sender_name || m.sender_type}</b><p>{m.body}</p></div>)}
            </div>
            <div className="suggestions">{suggestions.map(s => <button key={s} onClick={() => sendCommand(s)}>{s}</button>)}</div>
            <div className="row">
              <input value={command} onChange={e => setCommand(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') sendCommand() }} placeholder="Tell MightyMax what to do…" />
              <button onClick={() => sendCommand()}>Send</button>
            </div>
            <label className="toggle"><input type="checkbox" checked={dryRun} onChange={e => setDryRun(e.target.checked)} /> dry run / preview only</label>
          </div>
          <div className="panel"><h2>PM Bot Commands</h2><ul>
            <li>Show Kanban board for ABC Roofing</li>
            <li>Move task 4f1a2b3c to in progress</li>
            <li>Mark task 4f1a2b3c done</li>
            <li>Block task 4f1a2b3c because waiting for logo</li>
            <li>Create PM task write services page copy for ABC Roofing</li>
            <li>Ask WebsiteAgent to continue next ready task</li>
          </ul></div>
        </section>
      )}

      {tab === 'kanban' && (
        <section className="panel boardShell">
          <div className="boardHeader">
            <div><h2>Kanban Board</h2></div>
            <select value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)}>
              {projects.map(p => <option value={p.id} key={p.id}>{p.name}</option>)}
            </select>
            <button onClick={() => loadKanban()}>Refresh</button>
          </div>
          {kanban ? (
            <div className="kanban">
              {kanban.columns.map(({ column, tasks, count, wip_over_limit }) => (
                <div className={`kanbanCol ${wip_over_limit ? 'over' : ''}`} key={column.id}>
                  <h3>{column.label} <span>{count}</span></h3>
                  {column.wip_limit ? <small>WIP {count}/{column.wip_limit}</small> : null}
                  {tasks.map(task => (
                    <div className="kanbanCard" key={task.id}>
                      <b>{task.title}</b>
                      <small>{task.id.slice(0, 8)} · {task.assignee_agent || task.assignee_type} · {task.priority}</small>
                      {task.blocked_reason && <em>{task.blocked_reason}</em>}
                      <div className="cardActions">
                        <button onClick={() => moveTask(task.id, 'ready')}>Ready</button>
                        <button onClick={() => moveTask(task.id, 'in_progress')}>Doing</button>
                        <button onClick={() => moveTask(task.id, 'review')}>Review</button>
                        <button onClick={() => moveTask(task.id, 'done')}>Done</button>
                        <button onClick={() => queueTask(task)}>OpenClaw</button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : <p>No Kanban data yet.</p>}
        </section>
      )}

      {tab === 'supervisor' && <SupervisorPanel api={api} />}
      {tab === 'brief' && <DailyBriefPanel api={api} />}
      {tab === 'duplicates' && <DuplicatesPanel api={api} />}

      {tab === 'leads' && (
        <section className="columns">
          <div className="panel"><h2>Leads</h2>
            {leads.map(l => <div className="item" key={l.id}>
              <b>{l.name}</b>
              <small>{l.company} · <Badge label={l.status} color={statusColor(l.status)} /> · score {l.score}</small>
            </div>)}
          </div>
          <div className="panel"><h2>PM Workload</h2>
            {workload.map(w => <div className="item" key={w.assignee}>
              <b>{w.assignee}</b>
              <small>{w.open_tasks} open · {w.assigned_estimate_minutes} min · {w.utilization_percent}% capacity</small>
            </div>)}
          </div>
        </section>
      )}

      {tab === 'resources' && (
        <section className="panel">
          <h2>Enterprise Modules</h2>
          <div className="chips">{resources.map(r => <button className={r === selected ? 'active' : ''} onClick={() => loadResource(r)} key={r}>{r}</button>)}</div>
          <pre>{JSON.stringify(rows.slice(0, 6), null, 2)}</pre>
        </section>
      )}
    </main>
  )
}

createRoot(document.getElementById('root')).render(<App />)
