import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './style.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '')
  const [email, setEmail] = useState('owner@mightymax.ai')
  const [password, setPassword] = useState('mighty123')
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

  async function login(e) {
    e?.preventDefault()
    const res = await fetch(`${API}/auth/login`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ email, password }) })
    const data = await res.json()
    if (data.access_token) { localStorage.setItem('token', data.access_token); setToken(data.access_token) }
    else alert(JSON.stringify(data))
  }

  async function load() {
    if (!token) return
    const [o, pm, w, l, r, t, p] = await Promise.all([
      fetch(`${API}/enterprise/overview`, {headers}).then(r=>r.json()),
      fetch(`${API}/pm/executive-overview`, {headers}).then(r=>r.json()).catch(()=>null),
      fetch(`${API}/pm/workload`, {headers}).then(r=>r.json()).catch(()=>({items:[]})),
      fetch(`${API}/leads`, {headers}).then(r=>r.json()),
      fetch(`${API}/enterprise/resources`, {headers}).then(r=>r.json()),
      fetch(`${API}/messenger/threads`, {headers}).then(r=>r.json()).catch(()=>[]),
      fetch(`${API}/projects`, {headers}).then(r=>r.json()).catch(()=>[]),
    ])
    setOverview(o); setPmOverview(pm); setWorkload(w.items || []); setLeads(l); setResources(r.resources || []); setProjects(p || [])
    const firstThread = t?.[0]
    if (firstThread && !threadId) { setThreadId(firstThread.id); loadMessages(firstThread.id) }
    if ((p || []).length && !selectedProjectId) setSelectedProjectId(p[0].id)
  }

  async function loadMessages(id=threadId) {
    if (!id) return
    const data = await fetch(`${API}/messenger/threads/${id}/messages`, {headers}).then(r=>r.json())
    setMessages(data)
  }

  async function loadResource(name=selected) {
    if (!token) return
    const data = await fetch(`${API}/enterprise/${name}`, {headers}).then(r=>r.json()).catch(()=>[])
    setRows(Array.isArray(data) ? data : []); setSelected(name)
  }

  async function loadKanban(id=selectedProjectId) {
    if (!id) return
    const data = await fetch(`${API}/projects/${id}/kanban`, {headers}).then(r=>r.json())
    setKanban(data)
  }

  async function sendCommand(text=command) {
    if (!text.trim()) return
    const res = await fetch(`${API}/messenger/command`, {method:'POST', headers, body: JSON.stringify({text, thread_id: threadId, channel:'web', dry_run: dryRun})})
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
    await fetch(`${API}/projects/${selectedProjectId}/kanban/tasks/${taskId}/move`, {method:'PATCH', headers, body: JSON.stringify({column_key: columnKey})})
    await loadKanban(selectedProjectId)
  }

  async function queueTask(task) {
    if (!selectedProjectId) return
    await fetch(`${API}/projects/${selectedProjectId}/tasks/${task.id}/queue-openclaw`, {method:'POST', headers})
    await sendCommand(`Task ${task.id.slice(0,8)} queued to OpenClaw`)
  }

  useEffect(()=>{ load() }, [token])
  useEffect(()=>{ if(token) loadResource(selected) }, [token, selected])
  useEffect(()=>{ if(token && selectedProjectId) loadKanban(selectedProjectId) }, [token, selectedProjectId])

  if (!token) return <main className="login"><h1>Mighty CRM Command Center</h1><p>AI-first CRM + PM controlled by text messenger.</p><form onSubmit={login}><input value={email} onChange={e=>setEmail(e.target.value)} /><input value={password} onChange={e=>setPassword(e.target.value)} type="password"/><button>Login</button></form></main>
  const cards = overview ? Object.entries(overview) : []
  return <main>
    <header><div><h1>Mighty CRM + PM Command Center</h1><p>Kanban board + messenger bot + OpenClaw task execution from one workspace.</p></div><button onClick={()=>{localStorage.removeItem('token');setToken('')}}>Logout</button></header>

    <section className="grid">{cards.map(([k,v])=><article className="card" key={k}><span>{k.replaceAll('_',' ')}</span><strong>{String(v)}</strong></article>)}{pmOverview && Object.entries(pmOverview).filter(([k,v])=>typeof v !== 'object').map(([k,v])=><article className="card pm" key={'pm-'+k}><span>PM {k.replaceAll('_',' ')}</span><strong>{String(v)}</strong></article>)}</section>

    <section className="commandShell">
      <div className="chat">
        <h2>Mighty PM Messenger Bot</h2>
        <div className="messages">{messages.map(m=><div className={`bubble ${m.sender_type}`} key={m.id}><b>{m.sender_name || m.sender_type}</b><p>{m.body}</p></div>)}</div>
        <div className="suggestions">{suggestions.map(s=><button key={s} onClick={()=>sendCommand(s)}>{s}</button>)}</div>
        <div className="row"><input value={command} onChange={e=>setCommand(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')sendCommand()}} placeholder="Tell MightyMax what to do with CRM or PM..."/><button onClick={()=>sendCommand()}>Send</button></div>
        <label className="toggle"><input type="checkbox" checked={dryRun} onChange={e=>setDryRun(e.target.checked)} /> dry run / preview only</label>
      </div>
      <div className="panel"><h2>PM Bot Commands</h2><ul><li>Show Kanban board for ABC Roofing</li><li>Move task 4f1a2b3c to in progress</li><li>Move task "Generate homepage copy" to review</li><li>Mark task 4f1a2b3c done</li><li>Block task 4f1a2b3c because waiting for logo</li><li>Create PM task write services page copy for ABC Roofing and assign to WebsiteAgent</li><li>Ask WebsiteAgent to continue next ready task</li></ul></div>
    </section>

    <section className="panel boardShell">
      <div className="boardHeader"><div><h2>Kanban Board</h2><p>Drag-style PM control via API buttons now; messenger bot understands card movement by text.</p></div><select value={selectedProjectId} onChange={e=>setSelectedProjectId(e.target.value)}>{projects.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select><button onClick={()=>loadKanban()}>Refresh Board</button></div>
      {kanban ? <div className="kanban">{kanban.columns.map(({column, tasks, count, wip_over_limit})=><div className={`kanbanCol ${wip_over_limit?'over':''}`} key={column.id}><h3>{column.label} <span>{count}</span></h3>{column.wip_limit ? <small>WIP {count}/{column.wip_limit}</small> : null}{tasks.map(task=><div className="kanbanCard" key={task.id}><b>{task.title}</b><small>{task.id.slice(0,8)} · {task.assignee_agent || task.assignee_type} · {task.priority}</small>{task.blocked_reason && <em>{task.blocked_reason}</em>}<div className="cardActions"><button onClick={()=>moveTask(task.id,'ready')}>Ready</button><button onClick={()=>moveTask(task.id,'in_progress')}>Doing</button><button onClick={()=>moveTask(task.id,'review')}>Review</button><button onClick={()=>moveTask(task.id,'done')}>Done</button><button onClick={()=>queueTask(task)}>OpenClaw</button></div></div>)}</div>)}</div> : <p>No Kanban data yet. Generate a project first.</p>}
    </section>

    <section className="columns"><div className="panel"><h2>Leads</h2>{leads.map(l=><div className="item" key={l.id}><b>{l.name}</b><small>{l.company} · {l.status} · score {l.score}</small></div>)}</div>
    <div className="panel"><h2>PM Workload</h2>{workload.map(w=><div className="item" key={w.assignee}><b>{w.assignee}</b><small>{w.open_tasks} open tasks · {w.assigned_estimate_minutes} min · {w.utilization_percent}% capacity</small></div>)}<h2>Enterprise Modules</h2><div className="chips">{resources.map(r=><button className={r===selected?'active':''} onClick={()=>loadResource(r)} key={r}>{r}</button>)}</div><pre>{JSON.stringify(rows.slice(0,6), null, 2)}</pre></div></section>
  </main>
}

createRoot(document.getElementById('root')).render(<App />)
