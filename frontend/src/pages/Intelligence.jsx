import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Brain } from 'lucide-react'
import { get } from '../api'
import Spinner from '../components/Spinner'

const fmtDate = d => d ? new Date(d).toLocaleString() : '—'

export default function Intelligence() {
  const qc = useQueryClient()
  const [leadId, setLeadId] = useState('')
  const [lookupId, setLookupId] = useState('')

  const { data: report, isLoading: reportLoading, error: reportError, isFetching: reportFetching } = useQuery({
    queryKey: ['intelligence-executive-report'],
    queryFn: () => get('/intelligence/executive-report'),
    retry: false,
  })

  const { data: score, isLoading: scoreLoading, error: scoreError } = useQuery({
    queryKey: ['intelligence-score', lookupId],
    queryFn: () => get(`/intelligence/leads/${lookupId}/score`),
    enabled: !!lookupId,
    retry: false,
  })

  const { data: nextAction, isLoading: nextLoading, error: nextError } = useQuery({
    queryKey: ['intelligence-next-action', lookupId],
    queryFn: () => get(`/intelligence/leads/${lookupId}/next-action`),
    enabled: !!lookupId,
    retry: false,
  })

  function handleLookup() {
    const trimmed = leadId.trim()
    if (!trimmed) return
    if (trimmed !== lookupId) {
      setLookupId(trimmed)
    } else {
      qc.invalidateQueries({ queryKey: ['intelligence-score', lookupId] })
      qc.invalidateQueries({ queryKey: ['intelligence-next-action', lookupId] })
    }
  }

  const leadsAtRisk = report?.leads_at_risk ?? []
  const topOpportunities = report?.top_opportunities ?? []
  const actionItems = report?.action_items ?? []

  const leadLookupLoading = !!lookupId && (scoreLoading || nextLoading)
  const leadLookupError = scoreError || nextError

  const scoreComponents = score && typeof score === 'object'
    ? Object.entries(score).filter(([k]) => k !== 'overall_score' && k !== 'lead_id')
    : []

  return (
    <div>
      <div className="page-header">
        <div><h1>Intelligence</h1></div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="flex gap-2 items-center" style={{ marginBottom: 16, justifyContent: 'space-between' }}>
          <div className="flex gap-2 items-center">
            <Brain size={18} style={{ color: 'var(--text-muted)' }} />
            <h2 style={{ margin: 0, fontSize: 16 }}>Executive Report</h2>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            disabled={reportFetching}
            onClick={() => qc.refetchQueries({ queryKey: ['intelligence-executive-report'] })}
          >
            {reportFetching ? 'Generating…' : 'Generate Report'}
          </button>
        </div>

        <div className="text-xs td-muted" style={{ marginBottom: 16 }}>
          {report?.generated_at ? `Last generated: ${fmtDate(report.generated_at)}` : 'Not yet generated'}
        </div>

        {reportLoading && <Spinner />}
        {!reportLoading && reportError && !report && (
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No executive report available. Click Generate Report to create one.</p>
        )}

        {report && (
          <div>
            {report.summary && (
              <div style={{ marginBottom: 24 }}>
                <div className="font-medium text-sm" style={{ marginBottom: 8 }}>Summary</div>
                <pre style={{ whiteSpace: 'pre-wrap', fontSize: 14, fontFamily: 'inherit', margin: 0, lineHeight: 1.6, color: 'var(--text)' }}>
                  {report.summary}
                </pre>
              </div>
            )}

            {leadsAtRisk.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div className="font-medium text-sm" style={{ marginBottom: 8 }}>Leads at Risk</div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr><th>Lead</th><th>Reason</th><th>Score</th></tr>
                    </thead>
                    <tbody>
                      {leadsAtRisk.map((r, i) => (
                        <tr key={r.lead_id ?? i}>
                          <td className="td-muted text-sm">{r.lead_id ? r.lead_id.slice(0, 8) : '—'}</td>
                          <td className="text-sm">{r.reason || '—'}</td>
                          <td className="text-sm">{r.score ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {topOpportunities.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div className="font-medium text-sm" style={{ marginBottom: 8 }}>Top Opportunities</div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr><th>Title</th><th>Lead</th><th>Value</th><th>Probability</th></tr>
                    </thead>
                    <tbody>
                      {topOpportunities.map((o, i) => (
                        <tr key={i}>
                          <td className="font-medium text-sm">{o.title || '—'}</td>
                          <td className="td-muted text-sm">{o.lead || '—'}</td>
                          <td className="text-sm">{o.value ?? '—'}</td>
                          <td className="text-sm">{o.probability != null ? `${o.probability}%` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {actionItems.length > 0 && (
              <div>
                <div className="font-medium text-sm" style={{ marginBottom: 8 }}>Action Items</div>
                <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {actionItems.map((item, i) => (
                    <li key={i} className="text-sm">{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card">
        <div className="flex gap-2 items-center" style={{ marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Lead Intelligence</h2>
        </div>
        <div className="flex gap-2 items-center" style={{ marginBottom: 20 }}>
          <input
            className="form-input"
            style={{ maxWidth: 320 }}
            placeholder="Lead ID"
            value={leadId}
            onChange={e => setLeadId(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLookup()}
          />
          <button className="btn btn-primary" onClick={handleLookup} disabled={!leadId.trim()}>
            Lookup
          </button>
        </div>

        {leadLookupLoading && <Spinner />}

        {!leadLookupLoading && lookupId && leadLookupError && (
          <p style={{ color: 'var(--danger)', fontSize: 13 }}>No intelligence data for this lead.</p>
        )}

        {!leadLookupLoading && lookupId && !leadLookupError && (score || nextAction) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {score && (
              <div>
                <div className="font-medium text-sm" style={{ marginBottom: 10 }}>Lead Score</div>
                <div className="stats-grid">
                  <div className="stat-card">
                    <span className="stat-label">overall score</span>
                    <span className="stat-value">{score.overall_score ?? '—'}</span>
                  </div>
                  {scoreComponents.map(([key, val]) => (
                    <div key={key} className="stat-card">
                      <span className="stat-label">{key.replace(/_/g, ' ')}</span>
                      <span className="stat-value">{val ?? '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {nextAction && (
              <div>
                <div className="font-medium text-sm" style={{ marginBottom: 10 }}>Next Action</div>
                <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {nextAction.action_type && (
                    <div className="flex gap-2 items-center">
                      <span className="text-xs td-muted" style={{ minWidth: 90 }}>Action Type</span>
                      <span className="font-medium text-sm">{nextAction.action_type}</span>
                    </div>
                  )}
                  {nextAction.description && (
                    <div className="flex gap-2 items-center">
                      <span className="text-xs td-muted" style={{ minWidth: 90 }}>Description</span>
                      <span className="text-sm">{nextAction.description}</span>
                    </div>
                  )}
                  {nextAction.reason && (
                    <div className="flex gap-2 items-center">
                      <span className="text-xs td-muted" style={{ minWidth: 90 }}>Reason</span>
                      <span className="text-sm td-muted">{nextAction.reason}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
