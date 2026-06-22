import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { get, post, patch, del } from '../api'
import Spinner from '../components/Spinner'
import Badge from '../components/Badge'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'

const fmtDate = d => d ? new Date(d).toLocaleString() : '—'

const DEFAULT_STEP_JSON = `{"type":"send_email","to":"{{lead.email}}","subject":"Hello"}`

export default function Workflows() {
  const qc = useQueryClient()
  const [selected, setSelected] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', is_active: true })
  const [showAddStep, setShowAddStep] = useState(false)
  const [stepJson, setStepJson] = useState(DEFAULT_STEP_JSON)
  const [stepError, setStepError] = useState('')
  const [showRun, setShowRun] = useState(false)
  const [runLeadId, setRunLeadId] = useState('')
  const [runResult, setRunResult] = useState(null)
  const [patchError, setPatchError] = useState('')

  const { data: workflows = [], isLoading } = useQuery({
    queryKey: ['workflows'],
    queryFn: () => get('/workflows'),
  })

  const selectedWorkflow = workflows.find(w => w.id === selected) || null

  const createMut = useMutation({
    mutationFn: body => post('/workflows', body),
    onSuccess: (w) => {
      qc.invalidateQueries({ queryKey: ['workflows'] })
      setShowCreate(false)
      setCreateForm({ name: '', is_active: true })
      setSelected(w.id)
    },
  })

  const deleteMut = useMutation({
    mutationFn: id => del(`/workflows/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workflows'] })
      setSelected(null)
    },
  })

  const patchStepsMut = useMutation({
    mutationFn: ({ id, steps }) => patch(`/workflows/${id}`, { steps }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workflows'] })
      setPatchError('')
    },
    onError: (e) => setPatchError(e.message || 'Failed to update steps'),
  })

  const runMut = useMutation({
    mutationFn: ({ id, lead_id }) => {
      const url = lead_id ? `/workflows/${id}/run?lead_id=${encodeURIComponent(lead_id)}` : `/workflows/${id}/run`
      return post(url)
    },
    onSuccess: (data) => {
      setRunResult(data)
      setShowRun(false)
      setRunLeadId('')
    },
  })

  function handleDelete() {
    if (!selectedWorkflow) return
    if (!window.confirm(`Delete workflow "${selectedWorkflow.name}"?`)) return
    deleteMut.mutate(selectedWorkflow.id)
  }

  function handleAddStep() {
    setStepError('')
    let parsed
    try {
      parsed = JSON.parse(stepJson)
    } catch {
      setStepError('Invalid JSON')
      return
    }
    const currentSteps = Array.isArray(selectedWorkflow.steps) ? selectedWorkflow.steps : []
    patchStepsMut.mutate(
      { id: selectedWorkflow.id, steps: [...currentSteps, parsed] },
      {
        onSuccess: () => {
          setShowAddStep(false)
          setStepJson(DEFAULT_STEP_JSON)
        },
      }
    )
  }

  function handleRemoveStep(index) {
    const currentSteps = Array.isArray(selectedWorkflow.steps) ? selectedWorkflow.steps : []
    const updated = currentSteps.filter((_, i) => i !== index)
    patchStepsMut.mutate({ id: selectedWorkflow.id, steps: updated })
  }

  function handleRun() {
    runMut.mutate({ id: selectedWorkflow.id, lead_id: runLeadId || undefined })
  }

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      <div style={{ width: 300, flexShrink: 0, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="font-medium">Workflows</span>
          <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={() => setShowCreate(true)}>
            New Workflow
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {isLoading ? (
            <div style={{ padding: 16 }}><Spinner /></div>
          ) : workflows.length === 0 ? (
            <div style={{ padding: 16 }}><EmptyState title="No workflows" /></div>
          ) : (
            workflows.map(w => (
              <div
                key={w.id}
                onClick={() => { setSelected(w.id); setRunResult(null) }}
                style={{
                  padding: '12px 16px',
                  cursor: 'pointer',
                  borderBottom: '1px solid var(--border)',
                  background: selected === w.id ? 'var(--bg-hover, #f5f5f5)' : 'transparent',
                }}
              >
                <div className="font-medium text-sm" style={{ marginBottom: 4 }}>{w.name}</div>
                <div className="flex gap-2 items-center">
                  <span className="badge badge-gray text-xs">{Array.isArray(w.steps) ? w.steps.length : 0} steps</span>
                  <Badge label={w.is_active ? 'active' : 'inactive'} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        {!selectedWorkflow ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <EmptyState title="Select a workflow" />
          </div>
        ) : (
          <div>
            <div className="page-header" style={{ marginBottom: 24 }}>
              <div className="flex gap-2 items-center">
                <h1 style={{ margin: 0 }}>{selectedWorkflow.name}</h1>
                <Badge label={selectedWorkflow.is_active ? 'active' : 'inactive'} />
              </div>
              <div className="flex gap-2 items-center">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => { setShowRun(true); setRunResult(null) }}
                >
                  Run
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={handleDelete}
                  disabled={deleteMut.isPending}
                >
                  {deleteMut.isPending ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>

            <div className="card" style={{ marginBottom: 24 }}>
              <div className="flex gap-2 items-center" style={{ marginBottom: 12, justifyContent: 'space-between' }}>
                <span className="font-medium">Steps</span>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => { setShowAddStep(true); setStepJson(DEFAULT_STEP_JSON); setStepError('') }}
                >
                  Add Step
                </button>
              </div>
              {patchError && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 8 }}>{patchError}</p>}
              {!Array.isArray(selectedWorkflow.steps) || selectedWorkflow.steps.length === 0 ? (
                <p className="td-muted text-sm">No steps yet.</p>
              ) : (
                <ol style={{ margin: 0, padding: '0 0 0 20px' }}>
                  {selectedWorkflow.steps.map((step, i) => (
                    <li key={i} style={{ marginBottom: 12 }}>
                      <div className="flex gap-2 items-center" style={{ justifyContent: 'space-between' }}>
                        <span className="text-xs td-muted">Step {i + 1}</span>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: 12, color: 'var(--danger)' }}
                          onClick={() => handleRemoveStep(i)}
                          disabled={patchStepsMut.isPending}
                        >
                          Remove
                        </button>
                      </div>
                      <pre style={{ margin: '4px 0 0', padding: '8px', background: 'var(--bg-subtle, #f8f8f8)', borderRadius: 4, fontSize: 12, overflowX: 'auto', border: '1px solid var(--border)' }}>
                        {JSON.stringify(step, null, 2)}
                      </pre>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            {runResult && (
              <div className="card">
                <div className="font-medium" style={{ marginBottom: 12 }}>Run Results</div>
                {runResult.length === 0 ? (
                  <p className="td-muted text-sm">No actions produced.</p>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Action Key</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {runResult.map((action, i) => (
                          <tr key={i}>
                            <td className="font-medium text-sm">{action.key || action.action_key || action.type || `Action ${i + 1}`}</td>
                            <td><Badge label={action.status || '—'} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <Modal
        open={showCreate}
        onClose={() => { setShowCreate(false); setCreateForm({ name: '', is_active: true }) }}
        title="New Workflow"
        footer={
          <div className="flex gap-2 items-center" style={{ justifyContent: 'flex-end', width: '100%' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => { setShowCreate(false); setCreateForm({ name: '', is_active: true }) }}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              disabled={createMut.isPending || !createForm.name.trim()}
              onClick={() => createMut.mutate({ name: createForm.name, steps: [], is_active: createForm.is_active })}
            >
              {createMut.isPending ? 'Creating…' : 'Create'}
            </button>
          </div>
        }
      >
        <div className="form-group">
          <label className="form-label">Name *</label>
          <input
            className="form-input"
            autoFocus
            value={createForm.name}
            onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Workflow name"
          />
        </div>
        <div className="form-group">
          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={createForm.is_active}
              onChange={e => setCreateForm(f => ({ ...f, is_active: e.target.checked }))}
            />
            Active
          </label>
        </div>
        {createMut.isError && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{createMut.error?.message}</p>}
      </Modal>

      <Modal
        open={showAddStep}
        onClose={() => { setShowAddStep(false); setStepJson(DEFAULT_STEP_JSON); setStepError('') }}
        title="Add Step"
        footer={
          <div className="flex gap-2 items-center" style={{ justifyContent: 'flex-end', width: '100%' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => { setShowAddStep(false); setStepJson(DEFAULT_STEP_JSON); setStepError('') }}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              disabled={patchStepsMut.isPending}
              onClick={handleAddStep}
            >
              {patchStepsMut.isPending ? 'Saving…' : 'Add Step'}
            </button>
          </div>
        }
      >
        <div className="form-group">
          <label className="form-label">Step JSON</label>
          <textarea
            className="form-input"
            rows={8}
            value={stepJson}
            onChange={e => { setStepJson(e.target.value); setStepError('') }}
            style={{ fontFamily: 'monospace', fontSize: 13, resize: 'vertical' }}
          />
        </div>
        {stepError && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{stepError}</p>}
      </Modal>

      <Modal
        open={showRun}
        onClose={() => { setShowRun(false); setRunLeadId('') }}
        title={`Run: ${selectedWorkflow?.name || ''}`}
        footer={
          <div className="flex gap-2 items-center" style={{ justifyContent: 'flex-end', width: '100%' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => { setShowRun(false); setRunLeadId('') }}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              disabled={runMut.isPending}
              onClick={handleRun}
            >
              {runMut.isPending ? 'Running…' : 'Run'}
            </button>
          </div>
        }
      >
        <div className="form-group">
          <label className="form-label">Lead ID (optional)</label>
          <input
            className="form-input"
            value={runLeadId}
            onChange={e => setRunLeadId(e.target.value)}
            placeholder="Leave blank to run without a lead"
          />
        </div>
        {runMut.isError && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{runMut.error?.message}</p>}
      </Modal>
    </div>
  )
}
