import { useState } from 'react'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import { Sparkles, ChevronRight, Check, AlertCircle } from 'lucide-react'
import { post } from '../api'
import Modal from './Modal'

const PRIORITY_COLOR = { high: 'var(--danger)', medium: 'var(--warning)', low: 'var(--text-muted)' }
const AGENT_ABBR = name => name?.replace('Agent', '') || '?'

export default function AIScopeModal({ projectId, kanbanQueryKey, open, onClose }) {
  const qc = useQueryClient()
  const [step, setStep] = useState('describe') // 'describe' | 'review' | 'done'
  const [form, setForm] = useState({ description: '', additional_context: '' })
  const [plan, setPlan] = useState(null)       // { milestones: [...] }
  const [selected, setSelected] = useState({}) // { "m_idx:t_idx": bool }
  const [result, setResult] = useState(null)   // { milestones_created, tasks_created }

  function reset() {
    setStep('describe')
    setForm({ description: '', additional_context: '' })
    setPlan(null)
    setSelected({})
    setResult(null)
  }

  function handleClose() {
    onClose()
    setTimeout(reset, 300)
  }

  const preview = useMutation({
    mutationFn: body => post(`/projects/${projectId}/ai-scope/preview`, body),
    onSuccess: data => {
      setPlan(data)
      // Select all tasks by default
      const init = {}
      data.milestones.forEach((m, mi) =>
        m.tasks.forEach((_, ti) => { init[`${mi}:${ti}`] = true })
      )
      setSelected(init)
      setStep('review')
    },
  })

  const apply = useMutation({
    mutationFn: body => post(`/projects/${projectId}/ai-scope/apply`, body),
    onSuccess: data => {
      setResult(data)
      setStep('done')
      qc.invalidateQueries({ queryKey: kanbanQueryKey })
    },
  })

  function toggleTask(key) {
    setSelected(s => ({ ...s, [key]: !s[key] }))
  }

  function toggleMilestone(mi, taskCount) {
    const allOn = Array.from({ length: taskCount }, (_, ti) => selected[`${mi}:${ti}`]).every(Boolean)
    setSelected(s => {
      const next = { ...s }
      Array.from({ length: taskCount }, (_, ti) => { next[`${mi}:${ti}`] = !allOn })
      return next
    })
  }

  function handleApply() {
    const milestones = plan.milestones
      .map((m, mi) => ({
        ...m,
        tasks: m.tasks.filter((_, ti) => selected[`${mi}:${ti}`]),
      }))
      .filter(m => m.tasks.length > 0)
    apply.mutate({ milestones })
  }

  const selectedCount = Object.values(selected).filter(Boolean).length

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={
        <span className="flex items-center gap-2">
          <Sparkles size={16} style={{ color: 'var(--accent)' }} />
          Scope with AI
        </span>
      }
      footer={
        step === 'describe' ? (
          <>
            <button className="btn btn-secondary" onClick={handleClose}>Cancel</button>
            <button
              className="btn btn-primary flex gap-1 items-center"
              disabled={preview.isPending || !form.description.trim()}
              onClick={() => preview.mutate(form)}
            >
              {preview.isPending
                ? <><span className="spinner-sm" /> Thinking…</>
                : <><ChevronRight size={14} /> Generate Plan</>}
            </button>
          </>
        ) : step === 'review' ? (
          <>
            <button className="btn btn-secondary" onClick={() => setStep('describe')}>← Back</button>
            <button
              className="btn btn-primary flex gap-1 items-center"
              disabled={apply.isPending || selectedCount === 0}
              onClick={handleApply}
            >
              {apply.isPending
                ? <><span className="spinner-sm" /> Creating…</>
                : <><Check size={14} /> Add {selectedCount} task{selectedCount !== 1 ? 's' : ''} to board</>}
            </button>
          </>
        ) : (
          <button className="btn btn-primary" onClick={handleClose}>Done</button>
        )
      }
    >
      {step === 'describe' && (
        <div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            Describe what you want to build in plain language. AI will break it into milestones and tasks on your board.
          </p>
          <div className="form-group">
            <label className="form-label">What are you building? *</label>
            <textarea
              className="form-input"
              rows={4}
              autoFocus
              placeholder="e.g. Build a marketing website for our SaaS product. We need a homepage, pricing page, and a blog. Stack is React + Tailwind."
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              style={{ resize: 'vertical' }}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Additional context <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></label>
            <textarea
              className="form-input"
              rows={2}
              placeholder="Team size, tech stack, deadline, special requirements…"
              value={form.additional_context}
              onChange={e => setForm(f => ({ ...f, additional_context: e.target.value }))}
              style={{ resize: 'vertical' }}
            />
          </div>
          {preview.isError && (
            <div className="flex gap-2 items-center" style={{ color: 'var(--danger)', fontSize: 13, marginTop: 8 }}>
              <AlertCircle size={14} /> {preview.error?.message || 'Failed to generate plan'}
            </div>
          )}
        </div>
      )}

      {step === 'review' && plan && (
        <div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            {plan.milestone_count} milestones, {plan.task_count} tasks generated.
            Uncheck anything you don't need, then add to the board.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 420, overflowY: 'auto' }}>
            {plan.milestones.map((milestone, mi) => {
              const allOn = milestone.tasks.every((_, ti) => selected[`${mi}:${ti}`])
              return (
                <div key={mi} style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, overflow: 'hidden' }}>
                  <div
                    className="flex items-center gap-2"
                    style={{ padding: '10px 14px', background: 'var(--bg-surface)', cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)' }}
                    onClick={() => toggleMilestone(mi, milestone.tasks.length)}
                  >
                    <input
                      type="checkbox"
                      checked={allOn}
                      onChange={() => toggleMilestone(mi, milestone.tasks.length)}
                      onClick={e => e.stopPropagation()}
                      style={{ accentColor: 'var(--accent)', width: 15, height: 15 }}
                    />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{milestone.name}</span>
                    {milestone.description && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{milestone.description}</span>
                    )}
                  </div>
                  {milestone.tasks.map((task, ti) => {
                    const key = `${mi}:${ti}`
                    return (
                      <div
                        key={ti}
                        className="flex items-start gap-2"
                        style={{
                          padding: '8px 14px 8px 28px',
                          borderBottom: ti < milestone.tasks.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                          opacity: selected[key] ? 1 : 0.4,
                          cursor: 'pointer',
                          transition: 'opacity 0.15s',
                        }}
                        onClick={() => toggleTask(key)}
                      >
                        <input
                          type="checkbox"
                          checked={!!selected[key]}
                          onChange={() => toggleTask(key)}
                          onClick={e => e.stopPropagation()}
                          style={{ accentColor: 'var(--accent)', width: 14, height: 14, marginTop: 2, flexShrink: 0 }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13 }}>{task.title}</div>
                          {task.description && (
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{task.description}</div>
                          )}
                        </div>
                        <div className="flex gap-2 items-center" style={{ flexShrink: 0, marginLeft: 8 }}>
                          <span style={{ fontSize: 11, color: PRIORITY_COLOR[task.priority] || 'var(--text-muted)' }}>
                            {task.priority}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {AGENT_ABBR(task.agent)}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {task.estimate_minutes}m
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
          {apply.isError && (
            <div className="flex gap-2 items-center" style={{ color: 'var(--danger)', fontSize: 13, marginTop: 12 }}>
              <AlertCircle size={14} /> {apply.error?.message || 'Failed to create tasks'}
            </div>
          )}
        </div>
      )}

      {step === 'done' && result && (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>
            {result.tasks_created} task{result.tasks_created !== 1 ? 's' : ''} added to the board
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Across {result.milestones_created} milestone{result.milestones_created !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </Modal>
  )
}
