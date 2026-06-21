import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, GitBranch, Trash2 } from 'lucide-react'
import { get, post, patch, del } from '../../api'
import Spinner from '../../components/Spinner'
import Badge from '../../components/Badge'
import EmptyState from '../../components/EmptyState'
import Modal from '../../components/Modal'

const SEQ_STATUSES = ['active', 'paused', 'archived']
const ACTION_TYPES = ['email', 'sms', 'task']
const BLANK_STEP = { delay_days: 1, action_type: 'email', subject: '', body: '' }
const BLANK_SEQ = { name: '' }

export default function Sequences() {
  const qc = useQueryClient()
  const [selected, setSelected] = useState(null)
  const [tab, setTab] = useState('steps')
  const [showCreateSeq, setShowCreateSeq] = useState(false)
  const [seqForm, setSeqForm] = useState(BLANK_SEQ)
  const [showAddStep, setShowAddStep] = useState(false)
  const [stepForm, setStepForm] = useState(BLANK_STEP)
  const [showEnroll, setShowEnroll] = useState(false)
  const [enrollLeadId, setEnrollLeadId] = useState('')
  const [settingsForm, setSettingsForm] = useState({ name: '', status: 'active' })

  const { data: sequences = [], isLoading } = useQuery({
    queryKey: ['sequences'],
    queryFn: () => get('/sequences', { limit: 100 }),
  })

  const { data: steps = [], isLoading: stepsLoading } = useQuery({
    queryKey: ['sequences', selected?.id, 'steps'],
    queryFn: () => get(`/sequences/${selected.id}/steps`),
    enabled: !!selected && tab === 'steps',
  })

  const { data: enrollments = [], isLoading: enrollLoading } = useQuery({
    queryKey: ['sequences', selected?.id, 'enrollments'],
    queryFn: () => get(`/sequences/${selected.id}/enrollments`),
    enabled: !!selected && tab === 'enrollments',
  })

  const createSeq = useMutation({
    mutationFn: body => post('/sequences', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sequences'] }); setShowCreateSeq(false); setSeqForm(BLANK_SEQ) },
  })

  const addStep = useMutation({
    mutationFn: body => post(`/sequences/${selected.id}/steps`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sequences', selected.id, 'steps'] }); setShowAddStep(false); setStepForm(BLANK_STEP) },
  })

  const deleteStep = useMutation({
    mutationFn: stepId => del(`/sequences/${selected.id}/steps/${stepId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sequences', selected.id, 'steps'] }),
  })

  const enroll = useMutation({
    mutationFn: () => post(`/sequences/${selected.id}/enroll`, { lead_id: enrollLeadId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sequences', selected.id, 'enrollments'] }); setShowEnroll(false); setEnrollLeadId('') },
  })

  const updateSeq = useMutation({
    mutationFn: body => patch(`/sequences/${selected.id}`, body),
    onSuccess: data => { qc.invalidateQueries({ queryKey: ['sequences'] }); setSelected(data) },
  })

  const deleteSeq = useMutation({
    mutationFn: () => del(`/sequences/${selected.id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sequences'] }); setSelected(null) },
  })

  function selectSequence(seq) {
    setSelected(seq)
    setTab('steps')
    setSettingsForm({ name: seq.name, status: seq.status || 'active' })
  }

  if (isLoading) return <Spinner />

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Sequences</h1>
          <p>{sequences.length} sequence{sequences.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreateSeq(true)}>
          <Plus size={15} /> New Sequence
        </button>
      </div>

      <div className="flex gap-2" style={{ alignItems: 'flex-start' }}>
        <div className="card" style={{ width: 280, flexShrink: 0, padding: 0 }}>
          {sequences.length === 0 ? (
            <div style={{ padding: 24 }}>
              <EmptyState icon={GitBranch} title="No sequences" description="Create a sequence to get started." />
            </div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {sequences.map(seq => (
                <li
                  key={seq.id}
                  onClick={() => selectSequence(seq)}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    borderBottom: '1px solid var(--border)',
                    background: selected?.id === seq.id ? 'var(--bg-hover)' : 'transparent',
                  }}
                >
                  <div className="font-medium text-sm" style={{ marginBottom: 4 }}>{seq.name}</div>
                  <div className="flex gap-2 items-center">
                    <span className="text-xs td-muted">{seq.steps_count ?? 0} steps</span>
                    <Badge label={seq.status || 'active'} />
                  </div>
                  <div className="text-xs td-muted" style={{ marginTop: 2 }}>{new Date(seq.created_at).toLocaleDateString()}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card" style={{ flex: 1, minWidth: 0 }}>
          {!selected ? (
            <EmptyState icon={GitBranch} title="Select a sequence" description="Choose a sequence from the list to view details." />
          ) : (
            <div>
              <div className="flex gap-2 items-center" style={{ marginBottom: 16 }}>
                <h2 style={{ margin: 0, fontSize: 17 }}>{selected.name}</h2>
                <Badge label={selected.status || 'active'} />
              </div>
              <div className="tab-bar" style={{ marginBottom: 16 }}>
                {['steps', 'enrollments', 'settings'].map(t => (
                  <button key={t} className={`tab-item${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>

              {tab === 'steps' && (
                <div>
                  <div style={{ marginBottom: 12 }}>
                    <button className="btn btn-accent" onClick={() => setShowAddStep(true)}>
                      <Plus size={14} /> Add Step
                    </button>
                  </div>
                  {stepsLoading ? <Spinner /> : steps.length === 0 ? (
                    <EmptyState icon={GitBranch} title="No steps yet" description="Add steps to build your sequence." />
                  ) : (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Delay (days)</th>
                            <th>Action</th>
                            <th>Subject</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {steps.map((s, i) => (
                            <tr key={s.id}>
                              <td className="td-muted text-sm">{i + 1}</td>
                              <td className="td-muted">{s.delay_days}d</td>
                              <td><Badge label={s.action_type} /></td>
                              <td className="text-sm">{s.subject || '—'}</td>
                              <td>
                                <button
                                  className="btn btn-ghost btn-sm"
                                  disabled={deleteStep.isPending}
                                  onClick={() => { if (window.confirm('Delete this step?')) deleteStep.mutate(s.id) }}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {tab === 'enrollments' && (
                <div>
                  <div style={{ marginBottom: 12 }}>
                    <button className="btn btn-accent" onClick={() => setShowEnroll(true)}>
                      <Plus size={14} /> Enroll Lead
                    </button>
                  </div>
                  {enrollLoading ? <Spinner /> : enrollments.length === 0 ? (
                    <EmptyState icon={GitBranch} title="No enrollments" description="Enroll a lead to start this sequence." />
                  ) : (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Lead ID</th>
                            <th>Status</th>
                            <th>Enrolled At</th>
                          </tr>
                        </thead>
                        <tbody>
                          {enrollments.map(e => (
                            <tr key={e.id}>
                              <td className="font-medium">{e.lead_id}</td>
                              <td><Badge label={e.status} /></td>
                              <td className="td-muted text-sm">{new Date(e.enrolled_at).toLocaleDateString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {tab === 'settings' && (
                <div style={{ maxWidth: 420 }}>
                  <div className="form-group">
                    <label className="form-label">Name</label>
                    <input
                      className="form-input"
                      value={settingsForm.name}
                      onChange={e => setSettingsForm(f => ({ ...f, name: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select
                      className="form-input"
                      value={settingsForm.status}
                      onChange={e => setSettingsForm(f => ({ ...f, status: e.target.value }))}
                    >
                      {SEQ_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-2 items-center" style={{ marginTop: 8 }}>
                    <button
                      className="btn btn-primary"
                      disabled={updateSeq.isPending || !settingsForm.name.trim()}
                      onClick={() => updateSeq.mutate(settingsForm)}
                    >
                      {updateSeq.isPending ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      disabled={deleteSeq.isPending}
                      onClick={() => { if (window.confirm('Delete this sequence and all its steps?')) deleteSeq.mutate() }}
                    >
                      {deleteSeq.isPending ? 'Deleting…' : 'Delete Sequence'}
                    </button>
                  </div>
                  {updateSeq.error && <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 8 }}>{updateSeq.error.message}</p>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Modal
        open={showCreateSeq}
        onClose={() => { setShowCreateSeq(false); setSeqForm(BLANK_SEQ) }}
        title="New Sequence"
        footer={
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => { setShowCreateSeq(false); setSeqForm(BLANK_SEQ) }}>Cancel</button>
            <button
              className="btn btn-primary"
              disabled={createSeq.isPending || !seqForm.name.trim()}
              onClick={() => createSeq.mutate(seqForm)}
            >
              {createSeq.isPending ? 'Creating…' : 'Create'}
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Name *</label>
          <input
            className="form-input"
            autoFocus
            value={seqForm.name}
            onChange={e => setSeqForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Welcome Onboarding"
          />
        </div>
        {createSeq.error && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{createSeq.error.message}</p>}
      </Modal>

      <Modal
        open={showAddStep}
        onClose={() => { setShowAddStep(false); setStepForm(BLANK_STEP) }}
        title="Add Step"
        footer={
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => { setShowAddStep(false); setStepForm(BLANK_STEP) }}>Cancel</button>
            <button
              className="btn btn-primary"
              disabled={addStep.isPending}
              onClick={() => addStep.mutate(stepForm)}
            >
              {addStep.isPending ? 'Adding…' : 'Add Step'}
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Delay (days)</label>
          <input
            className="form-input"
            type="number"
            min={0}
            value={stepForm.delay_days}
            onChange={e => setStepForm(f => ({ ...f, delay_days: parseInt(e.target.value) || 0 }))}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Action Type</label>
          <select
            className="form-input"
            value={stepForm.action_type}
            onChange={e => setStepForm(f => ({ ...f, action_type: e.target.value }))}
          >
            {ACTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Subject</label>
          <input
            className="form-input"
            value={stepForm.subject}
            onChange={e => setStepForm(f => ({ ...f, subject: e.target.value }))}
            placeholder="Email subject or task title"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Body</label>
          <textarea
            className="form-input"
            rows={4}
            value={stepForm.body}
            onChange={e => setStepForm(f => ({ ...f, body: e.target.value }))}
            placeholder="Message body"
            style={{ resize: 'vertical' }}
          />
        </div>
        {addStep.error && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{addStep.error.message}</p>}
      </Modal>

      <Modal
        open={showEnroll}
        onClose={() => { setShowEnroll(false); setEnrollLeadId('') }}
        title="Enroll Lead"
        footer={
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => { setShowEnroll(false); setEnrollLeadId('') }}>Cancel</button>
            <button
              className="btn btn-primary"
              disabled={enroll.isPending || !enrollLeadId.trim()}
              onClick={() => enroll.mutate()}
            >
              {enroll.isPending ? 'Enrolling…' : 'Enroll'}
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Lead ID *</label>
          <input
            className="form-input"
            autoFocus
            value={enrollLeadId}
            onChange={e => setEnrollLeadId(e.target.value)}
            placeholder="Enter lead ID"
          />
        </div>
        {enroll.error && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{enroll.error.message}</p>}
      </Modal>
    </div>
  )
}
