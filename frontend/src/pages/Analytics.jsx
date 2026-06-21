import { useQuery } from '@tanstack/react-query'
import { get } from '../api'
import Spinner from '../components/Spinner'

const fmtCurrency = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

export default function Analytics() {
  const { data: pipelineData, isLoading: lp } = useQuery({ queryKey: ['analytics-pipeline'], queryFn: () => get('/analytics/pipeline') })
  const { data: forecastData, isLoading: lf } = useQuery({ queryKey: ['analytics-forecast'], queryFn: () => get('/analytics/forecast') })
  const { data: velocityData, isLoading: lv } = useQuery({ queryKey: ['analytics-velocity'], queryFn: () => get('/analytics/velocity') })
  const { data: conversionsData, isLoading: lc } = useQuery({ queryKey: ['analytics-conversions'], queryFn: () => get('/analytics/conversions') })
  const { data: agentData, isLoading: la } = useQuery({ queryKey: ['analytics-agents'], queryFn: () => get('/analytics/agent-performance') })
  const { data: sourcesData, isLoading: ls } = useQuery({ queryKey: ['analytics-sources'], queryFn: () => get('/analytics/lead-sources') })

  const stages = pipelineData?.stages ?? []
  const months = forecastData?.months ?? []
  const velocity = velocityData ?? {}
  const conversions = conversionsData?.conversions ?? []
  const agents = (agentData?.agents ?? []).slice().sort((a, b) => (b.total_runs ?? 0) - (a.total_runs ?? 0))
  const sources = sourcesData?.sources ?? []

  const maxStageCount = stages.length ? Math.max(...stages.map(s => s.count ?? 0)) : 1
  const maxSourceCount = sources.length ? Math.max(...sources.map(s => s.count ?? 0)) : 1

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Analytics</h1>
          <p>Pipeline, forecast, and performance insights</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>

        <div className="card">
          <h3 className="font-semibold mb-4" style={{ fontSize: 14 }}>Pipeline Funnel</h3>
          {lp ? <Spinner center={false} /> : stages.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No pipeline data</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {stages.map(s => {
                const pct = maxStageCount > 0 ? Math.round(((s.count ?? 0) / maxStageCount) * 100) : 0
                return (
                  <div key={s.name}>
                    <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
                      <span className="text-sm font-medium">{s.name ?? '—'}</span>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {s.count ?? '—'} · {s.value != null ? fmtCurrency(s.value) : '—'}
                      </span>
                    </div>
                    <div style={{ background: 'var(--border-subtle)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)', borderRadius: 4, transition: 'width .3s' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="font-semibold mb-4" style={{ fontSize: 14 }}>Revenue Forecast</h3>
          {lf ? <Spinner center={false} /> : months.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No forecast data</p>
          ) : (
            <div className="table-wrap" style={{ margin: '0 -4px' }}>
              <table>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Projected Revenue</th>
                    <th>Deals</th>
                  </tr>
                </thead>
                <tbody>
                  {months.map((m, i) => (
                    <tr key={m.month ?? i}>
                      <td className="font-medium">{m.month ?? '—'}</td>
                      <td style={{ color: 'var(--success)' }}>{m.projected_revenue != null ? fmtCurrency(m.projected_revenue) : '—'}</td>
                      <td className="td-muted">{m.deals_count ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <h3 className="font-semibold mb-4" style={{ fontSize: 14 }}>Sales Velocity</h3>
          {lv ? <Spinner center={false} /> : (
            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-label">avg cycle days</span>
                <span className="stat-value">{velocity.avg_cycle_days ?? '—'}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">win rate</span>
                <span className="stat-value" style={{ color: 'var(--success)' }}>
                  {velocity.win_rate != null ? `${velocity.win_rate}%` : '—'}
                </span>
              </div>
              <div className="stat-card">
                <span className="stat-label">avg deal value</span>
                <span className="stat-value">{velocity.avg_deal_value != null ? fmtCurrency(velocity.avg_deal_value) : '—'}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">deals won</span>
                <span className="stat-value" style={{ color: 'var(--success)' }}>{velocity.deals_won ?? '—'}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">deals lost</span>
                <span className="stat-value" style={{ color: 'var(--danger)' }}>{velocity.deals_lost ?? '—'}</span>
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="font-semibold mb-4" style={{ fontSize: 14 }}>Stage Conversions</h3>
          {lc ? <Spinner center={false} /> : conversions.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No conversion data</p>
          ) : (
            <div className="table-wrap" style={{ margin: '0 -4px' }}>
              <table>
                <thead>
                  <tr>
                    <th>From</th>
                    <th>To</th>
                    <th>Count</th>
                    <th>Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {conversions.map((c, i) => {
                    const rate = c.rate ?? 0
                    return (
                      <tr key={i}>
                        <td className="td-muted">{c.from_stage ?? '—'}</td>
                        <td className="td-muted">{c.to_stage ?? '—'}</td>
                        <td>{c.count ?? '—'}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{rate}%</span>
                            <div style={{ flex: 1, minWidth: 60, background: 'var(--border-subtle)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                              <div style={{ width: `${Math.min(rate, 100)}%`, height: '100%', background: 'var(--accent)', borderRadius: 4 }} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="font-semibold mb-4" style={{ fontSize: 14 }}>Agent Performance</h3>
          {la ? <Spinner center={false} /> : agents.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No agent data</p>
          ) : (
            <div className="table-wrap" style={{ margin: '0 -4px' }}>
              <table>
                <thead>
                  <tr>
                    <th>Agent</th>
                    <th>Runs</th>
                    <th>Success</th>
                    <th>Avg Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {agents.map((a, i) => (
                    <tr key={a.agent_key ?? i}>
                      <td className="font-medium">{a.agent_key ?? '—'}</td>
                      <td>{a.total_runs ?? '—'}</td>
                      <td style={{ color: 'var(--success)' }}>{a.success_rate != null ? `${a.success_rate}%` : '—'}</td>
                      <td className="td-muted">{a.avg_duration_seconds != null ? `${a.avg_duration_seconds}s` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <h3 className="font-semibold mb-4" style={{ fontSize: 14 }}>Lead Sources</h3>
          {ls ? <Spinner center={false} /> : sources.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No source data</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {sources.map(s => {
                const pct = maxSourceCount > 0 ? Math.round(((s.count ?? 0) / maxSourceCount) * 100) : 0
                return (
                  <div key={s.source} className="flex items-center gap-2" style={{ gap: 12 }}>
                    <span className="text-sm font-medium" style={{ minWidth: 120 }}>{s.source ?? '—'}</span>
                    <div style={{ flex: 1, background: 'var(--border-subtle)', borderRadius: 4, height: 10, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)', borderRadius: 4, transition: 'width .3s' }} />
                    </div>
                    <span className="text-xs" style={{ color: 'var(--text-muted)', minWidth: 32, textAlign: 'right' }}>{s.count ?? '—'}</span>
                    <span className="text-xs" style={{ color: 'var(--success)', minWidth: 40, textAlign: 'right' }}>
                      {s.won_count != null ? `${s.won_count} won` : '—'}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)', minWidth: 44, textAlign: 'right' }}>
                      {s.conversion_rate != null ? `${s.conversion_rate}%` : '—'}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
