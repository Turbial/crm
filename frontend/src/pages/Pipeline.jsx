import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { TrendingUp, Target, Calendar, DollarSign } from 'lucide-react'
import { get } from '../api'
import Spinner from '../components/Spinner'
import Badge from '../components/Badge'
import ProgressBar from '../components/ProgressBar'
import { formatMoney } from '../components/MoneyDisplay'
import TabBar from '../components/TabBar'
import StatsGrid from '../components/StatsGrid'
import StatCard from '../components/StatCard'

const STAGES = ['lead', 'qualified', 'proposal', 'negotiation', 'won']
const STAGE_PROB = { lead: 10, qualified: 30, proposal: 60, negotiation: 80, negotiation: 80, won: 100 }

function groupByStage(deals) {
  const map = {}
  for (const d of deals) {
    const s = d.stage || 'lead'
    if (!map[s]) map[s] = { count: 0, value: 0, deals: [] }
    map[s].count++
    map[s].value += d.value || 0
    map[s].deals.push(d)
  }
  return map
}

function groupByMonth(deals) {
  const map = {}
  for (const d of deals) {
    if (!d.expected_close_date) continue
    const month = d.expected_close_date.slice(0, 7)
    if (!map[month]) map[month] = { count: 0, value: 0, weighted: 0 }
    map[month].count++
    map[month].value += d.value || 0
    const prob = (d.probability ?? STAGE_PROB[d.stage] ?? 50) / 100
    map[month].weighted += (d.value || 0) * prob
  }
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).slice(0, 12)
}

const TABS = [
  { key: 'stage', label: 'By Stage' },
  { key: 'forecast', label: 'Forecast by Month' },
  { key: 'list', label: 'All Open Deals' },
]

export default function Pipeline() {
  const [tab, setTab] = useState('stage')

  const { data: deals = [], isLoading } = useQuery({
    queryKey: ['pipeline-deals'],
    queryFn: () => get('/deals', { limit: 500 }),
  })

  if (isLoading) return <Spinner />

  const openDeals = deals.filter(d => !['won', 'lost'].includes(d.stage))
  const wonDeals = deals.filter(d => d.stage === 'won')
  const totalPipeline = openDeals.reduce((s, d) => s + (d.value || 0), 0)
  const weightedPipeline = openDeals.reduce((s, d) => {
    const prob = (d.probability ?? STAGE_PROB[d.stage] ?? 50) / 100
    return s + (d.value || 0) * prob
  }, 0)
  const totalWon = wonDeals.reduce((s, d) => s + (d.value || 0), 0)
  const byStage = groupByStage(openDeals)
  const byMonth = groupByMonth(openDeals)
  const maxValue = Math.max(...STAGES.map(s => byStage[s]?.value || 0), 1)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Pipeline</h1>
          <p>Forecast and deal distribution</p>
        </div>
      </div>

      <StatsGrid style={{ marginBottom: 24 }}>
        <StatCard label="Total Pipeline" value={formatMoney(totalPipeline)} color="var(--accent)" />
        <StatCard label="Weighted Forecast" value={formatMoney(weightedPipeline)} color="var(--warning)" />
        <StatCard label="Open Deals" value={openDeals.length} />
        <StatCard label="Won (all time)" value={formatMoney(totalWon)} color="var(--success)" />
      </StatsGrid>

      <TabBar tabs={TABS} active={tab} onChange={setTab} style={{ marginBottom: 20 }} />

      {tab === 'stage' && (
        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 20 }}>Pipeline by Stage</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {STAGES.map(stage => {
              const data = byStage[stage] || { count: 0, value: 0, deals: [] }
              return (
                <div key={stage}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Badge label={stage} />
                      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{data.count} deal{data.count !== 1 ? 's' : ''}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 20, fontSize: 13 }}>
                      <span style={{ fontWeight: 600 }}>{formatMoney(data.value)}</span>
                      <span style={{ color: 'var(--text-muted)' }}>
                        weighted: {formatMoney(data.value * (STAGE_PROB[stage] || 50) / 100)}
                      </span>
                    </div>
                  </div>
                  <ProgressBar value={data.value} max={maxValue} height={12}
                    color={stage === 'negotiation' ? 'var(--warning)' : stage === 'proposal' ? 'var(--accent)' : 'var(--border)'}
                  />
                  {data.deals.length > 0 && (
                    <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {data.deals.slice(0, 5).map(d => (
                        <Link
                          key={d.id}
                          to={`/crm/deals/${d.id}`}
                          style={{
                            fontSize: 11.5, padding: '2px 8px', borderRadius: 6,
                            background: 'var(--bg)', border: '1px solid var(--border)',
                            color: 'var(--text)', textDecoration: 'none',
                          }}
                        >
                          {d.title || d.name} · {formatMoney(d.value)}
                        </Link>
                      ))}
                      {data.deals.length > 5 && (
                        <span style={{ fontSize: 11.5, color: 'var(--text-muted)', padding: '2px 4px' }}>
                          +{data.deals.length - 5} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {tab === 'forecast' && (
        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 20 }}>Monthly Forecast (by Expected Close Date)</h3>
          {byMonth.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No deals have an expected close date set.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {byMonth.map(([month, data]) => {
                const maxMonthVal = Math.max(...byMonth.map(([, d]) => d.value), 1)
                return (
                  <div key={month}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>
                        {new Date(month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </span>
                      <div style={{ display: 'flex', gap: 24, fontSize: 13 }}>
                        <span style={{ color: 'var(--text-muted)' }}>{data.count} deals</span>
                        <span style={{ fontWeight: 500 }}>Total: {formatMoney(data.value)}</span>
                        <span style={{ color: 'var(--success)', fontWeight: 600 }}>
                          Weighted: {formatMoney(data.weighted)}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <ProgressBar value={data.value} max={maxMonthVal} height={8} color="var(--border)"
                        style={{ flex: 1 }} />
                      <ProgressBar value={data.weighted} max={maxMonthVal} height={8} color="var(--success)"
                        style={{ flex: 1 }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <div style={{ marginTop: 20, display: 'flex', gap: 16, fontSize: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 12, height: 8, borderRadius: 2, background: 'var(--border)' }} />
              <span style={{ color: 'var(--text-muted)' }}>Total deal value</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 12, height: 8, borderRadius: 2, background: 'var(--success)' }} />
              <span style={{ color: 'var(--text-muted)' }}>Probability-weighted</span>
            </div>
          </div>
        </div>
      )}

      {tab === 'list' && (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Deal</th>
                  <th>Stage</th>
                  <th>Value</th>
                  <th>Probability</th>
                  <th>Weighted</th>
                  <th>Close Date</th>
                </tr>
              </thead>
              <tbody>
                {openDeals
                  .sort((a, b) => (b.value || 0) - (a.value || 0))
                  .map(d => {
                    const prob = d.probability ?? STAGE_PROB[d.stage] ?? 50
                    return (
                      <tr key={d.id} style={{ cursor: 'pointer' }} onClick={() => {}}>
                        <td>
                          <Link to={`/crm/deals/${d.id}`} style={{ color: 'var(--text)', fontWeight: 500 }}>
                            {d.title || d.name}
                          </Link>
                        </td>
                        <td><Badge label={d.stage || 'lead'} /></td>
                        <td style={{ color: 'var(--success)', fontWeight: 500 }}>{formatMoney(d.value)}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 12, minWidth: 32 }}>{prob}%</span>
                            <ProgressBar value={prob} max={100} height={6} style={{ width: 60 }}
                              color={prob >= 70 ? 'var(--success)' : prob >= 40 ? 'var(--warning)' : 'var(--danger)'}
                            />
                          </div>
                        </td>
                        <td style={{ color: 'var(--success)', fontSize: 13 }}>
                          {formatMoney((d.value || 0) * prob / 100)}
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                          {d.expected_close_date ? new Date(d.expected_close_date).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
