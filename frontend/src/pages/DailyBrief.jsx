import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FileText } from 'lucide-react'
import { get, post } from '../api'
import Spinner from '../components/Spinner'
import Badge from '../components/Badge'
import EmptyState from '../components/EmptyState'

const ICONS = { tasks_due_today: '📋', overdue_tasks: '⚠️', pending_approvals: '✅', hot_leads: '🔥', blocked_projects: '🚫', revenue_snapshot: '💰', agent_health: '🤖' }

export default function DailyBrief() {
  const qc = useQueryClient()

  const { data: brief, isLoading, isError } = useQuery({
    queryKey: ['brief-latest'],
    queryFn: () => get('/daily-brief/latest'),
    retry: false,
  })

  const generate = useMutation({
    mutationFn: () => post('/daily-brief/generate'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brief-latest'] }),
  })

  if (isLoading) return <Spinner />

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Daily Brief</h1>
          {brief && <p>{new Date(brief.brief_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>}
        </div>
        <button className="btn btn-primary" onClick={() => generate.mutate()} disabled={generate.isPending}>
          {generate.isPending ? 'Generating…' : 'Generate Now'}
        </button>
      </div>

      {generate.isError && (
        <div style={{ background: 'var(--danger-soft)', color: 'var(--danger)', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 20 }}>
          {generate.error.message}
        </div>
      )}

      {!brief && !generate.isPending
        ? <EmptyState icon={FileText} title="No brief yet" description='Click "Generate Now" to create today\'s brief.' />
        : brief && (
          <div>
            <div className="flex gap-3 items-center mb-4">
              <Badge label={brief.status} />
              {brief.delivered_at && <span className="text-xs text-muted">Delivered {new Date(brief.delivered_at).toLocaleTimeString()}</span>}
            </div>
            {brief.summary_text && (
              <div className="card mb-4">
                <p style={{ fontSize: 14, lineHeight: 1.7 }}>{brief.summary_text}</p>
              </div>
            )}
            <div className="grid-auto">
              {Object.entries(brief.sections || {}).map(([key, val]) => (
                <div key={key} className="card">
                  <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12 }}>
                    {ICONS[key] || '•'} {key.replace(/_/g, ' ')}
                  </h3>
                  {Array.isArray(val)
                    ? val.length === 0
                      ? <p className="text-muted text-sm">None</p>
                      : val.map((item, i) => (
                        <div key={i} className="text-sm" style={{ padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                          {typeof item === 'object'
                            ? Object.entries(item).map(([k, v]) => <span key={k} style={{ marginRight: 8 }}><b>{k}:</b> {String(v)}</span>)
                            : String(item)}
                        </div>
                      ))
                    : typeof val === 'object'
                      ? <pre style={{ fontSize: 12, margin: 0, background: 'var(--bg)', padding: 10, borderRadius: 8, overflow: 'auto' }}>{JSON.stringify(val, null, 2)}</pre>
                      : <strong style={{ fontSize: 22 }}>{String(val)}</strong>}
                </div>
              ))}
            </div>
          </div>
        )}
    </div>
  )
}
