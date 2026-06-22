import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { TrendingUp, Users, Briefcase, DollarSign, CheckSquare, AlertCircle, Target, ArrowRight, Clock, BarChart2 } from 'lucide-react'
import { get } from '../api'
import { useAuth } from '../contexts/AuthContext'
import {
  Spinner, Badge, EmptyState, StatCard, StatsGrid, ProgressBar,
  SectionCard, DataTable, MoneyDisplay, formatMoney, RelativeTime,
} from '../components'

const TODAY = new Date()
TODAY.setHours(0, 0, 0, 0)

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

const STAGE_ORDER = ['lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost']

function stageColor(stage) {
  const map = {
    lead: 'var(--text-muted)',
    qualified: 'var(--accent)',
    proposal: '#8b5cf6',
    negotiation: '#f59e0b',
    closed_won: 'var(--success)',
    closed_lost: 'var(--danger)',
  }
  return map[stage] || 'var(--accent)'
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()

  // KPI analytics (may not exist)
  const { data: analytics } = useQuery({
    queryKey: ['analytics-dashboard'],
    queryFn: () => get('/analytics/dashboard'),
    retry: false,
  })

  // Deals for pipeline + top deals
  const { data: deals = [], isLoading: dealsLoading } = useQuery({
    queryKey: ['dashboard-deals'],
    queryFn: () => get('/deals', { limit: 100 }),
    retry: false,
  })

  // Leads for recent leads
  const { data: leads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ['dashboard-leads'],
    queryFn: () => get('/leads', { limit: 50 }),
    retry: false,
  })

  // Tasks for upcoming
  const { data: tasks = [] } = useQuery({
    queryKey: ['dashboard-tasks'],
    queryFn: () => get('/tasks', { limit: 50 }),
    retry: false,
  })

  if (dealsLoading && leadsLoading) return <Spinner />

  // ---- KPI calculations (client-side fallback if analytics endpoint missing) ----
  const openDeals = deals.filter(d => d.stage !== 'closed_won' && d.stage !== 'closed_lost')
  const pipelineValue = analytics?.pipeline_value
    ?? openDeals.reduce((sum, d) => sum + (d.value || 0), 0)

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const wonThisMonth = analytics?.won_this_month
    ?? deals
        .filter(d => d.stage === 'closed_won' && d.closed_at && new Date(d.closed_at) >= startOfMonth)
        .reduce((sum, d) => sum + (d.value || 0), 0)

  const openLeads = analytics?.open_leads
    ?? leads.filter(l => l.status !== 'won' && l.status !== 'lost').length

  const tasksDueToday = analytics?.tasks_due_today
    ?? tasks.filter(t => {
        if (!t.due_at) return false
        const due = new Date(t.due_at)
        due.setHours(0, 0, 0, 0)
        return due <= TODAY
      }).length

  // ---- Pipeline by stage ----
  const stageMap = {}
  openDeals.forEach(d => {
    const s = d.stage || 'unknown'
    if (!stageMap[s]) stageMap[s] = { count: 0, value: 0 }
    stageMap[s].count++
    stageMap[s].value += d.value || 0
  })
  const stages = Object.entries(stageMap)
    .sort(([a], [b]) => {
      const ai = STAGE_ORDER.indexOf(a)
      const bi = STAGE_ORDER.indexOf(b)
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
    })
  const maxStageValue = Math.max(1, ...stages.map(([, v]) => v.value))

  // ---- Top deals ----
  const topDeals = [...openDeals]
    .sort((a, b) => (b.value || 0) - (a.value || 0))
    .slice(0, 5)

  // ---- Upcoming tasks ----
  const upcomingTasks = tasks
    .filter(t => t.due_at)
    .sort((a, b) => new Date(a.due_at) - new Date(b.due_at))
    .slice(0, 5)

  // ---- Recent leads (newest first) ----
  const recentLeads = [...leads]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5)

  const userName = user?.name || user?.email?.split('@')[0] || 'there'

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: 2 }}>
            {greeting()}, {userName}
          </p>
        </div>
      </div>

      {/* ROW 1 — KPI Stats */}
      <StatsGrid columns={4}>
        <StatCard
          label="Total Pipeline Value"
          value={formatMoney(pipelineValue)}
          color="var(--accent)"
        />
        <StatCard
          label="Won This Month"
          value={formatMoney(wonThisMonth)}
          color="var(--success)"
        />
        <StatCard
          label="Open Leads"
          value={openLeads}
        />
        <StatCard
          label="Tasks Due Today"
          value={tasksDueToday}
          color={tasksDueToday > 0 ? 'var(--warning, #f59e0b)' : undefined}
        />
      </StatsGrid>

      {/* ROW 2 — Pipeline by Stage + Recent Activity */}
      <div className="two-col" style={{ marginTop: 20 }}>
        <SectionCard
          title="Pipeline by Stage"
          icon={BarChart2}
          action={
            <Link to="/crm/deals" className="btn btn-ghost btn-sm" style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              View all <ArrowRight size={12} />
            </Link>
          }
        >
          {stages.length === 0 ? (
            <EmptyState title="No open deals" description="Start by creating a deal." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {stages.map(([stage, { count, value }]) => (
                <div key={stage}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                    <span style={{ fontWeight: 500, textTransform: 'capitalize' }}>{stage.replace(/_/g, ' ')}</span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      {count} deal{count !== 1 ? 's' : ''} · <MoneyDisplay amount={value} style={{ fontWeight: 400 }} />
                    </span>
                  </div>
                  <ProgressBar value={value} max={maxStageValue} color={stageColor(stage)} height={8} />
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Recent Leads Activity"
          icon={Clock}
          action={
            <Link to="/crm/leads" className="btn btn-ghost btn-sm" style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              View all <ArrowRight size={12} />
            </Link>
          }
        >
          {recentLeads.length === 0 ? (
            <EmptyState title="No leads yet" description="Create your first lead to get started." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {recentLeads.map(l => (
                <div
                  key={l.id}
                  onClick={() => navigate(`/crm/leads/${l.id}`)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                >
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{l.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {l.company || l.email || '—'} · <RelativeTime date={l.created_at} />
                    </div>
                  </div>
                  <Badge label={l.status} />
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* ROW 3 — Top Deals + Upcoming Tasks */}
      <div className="two-col" style={{ marginTop: 20 }}>
        <SectionCard
          title="Top Deals"
          icon={TrendingUp}
          action={
            <Link to="/crm/deals" className="btn btn-ghost btn-sm" style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              View all <ArrowRight size={12} />
            </Link>
          }
          noPad
        >
          <DataTable
            data={topDeals}
            emptyTitle="No open deals"
            emptyDescription="Create deals to track your pipeline."
            columns={[
              {
                key: 'name',
                label: 'Deal',
                render: row => (
                  <Link
                    to={`/crm/deals/${row.id}`}
                    style={{ color: 'var(--accent)', fontWeight: 500 }}
                    onClick={e => e.stopPropagation()}
                  >
                    {row.name || row.title || 'Untitled'}
                  </Link>
                ),
              },
              {
                key: 'stage',
                label: 'Stage',
                render: row => <Badge label={row.stage} />,
              },
              {
                key: 'value',
                label: 'Value',
                render: row => <MoneyDisplay amount={row.value} />,
              },
              {
                key: 'close_date',
                label: 'Close Date',
                render: row => row.close_date ? new Date(row.close_date).toLocaleDateString() : '—',
                className: 'td-muted text-sm',
              },
              {
                key: 'probability',
                label: 'Prob.',
                render: row => row.probability != null ? `${row.probability}%` : '—',
                className: 'td-muted text-sm',
              },
            ]}
            onRowClick={row => navigate(`/crm/deals/${row.id}`)}
          />
        </SectionCard>

        <SectionCard
          title="Upcoming Tasks"
          icon={CheckSquare}
          action={
            <Link to="/crm/tasks" className="btn btn-ghost btn-sm" style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              View all <ArrowRight size={12} />
            </Link>
          }
        >
          {upcomingTasks.length === 0 ? (
            <EmptyState title="No upcoming tasks" description="You're all caught up!" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {upcomingTasks.map(t => {
                const due = new Date(t.due_at)
                due.setHours(0, 0, 0, 0)
                const isOverdue = due < TODAY
                const isDueToday = due.getTime() === TODAY.getTime()
                return (
                  <div
                    key={t.id}
                    style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)', gap: 8 }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {t.title || t.name || 'Untitled task'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                        {t.lead_name || t.lead_id ? (t.lead_name || `Lead ${String(t.lead_id).slice(0, 8)}`) : '—'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                      <Badge label={t.priority || 'normal'} />
                      <span style={{ fontSize: 11, color: isOverdue ? 'var(--danger)' : isDueToday ? 'var(--warning, #f59e0b)' : 'var(--text-muted)', fontWeight: isOverdue || isDueToday ? 600 : 400 }}>
                        {isOverdue ? 'Overdue' : isDueToday ? 'Due today' : new Date(t.due_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </SectionCard>
      </div>

      {/* ROW 4 — Recent Leads list + Quick Actions */}
      <div className="two-col" style={{ marginTop: 20 }}>
        <SectionCard
          title="Recent Leads"
          icon={Users}
          action={
            <Link to="/crm/leads" className="btn btn-ghost btn-sm" style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              View all <ArrowRight size={12} />
            </Link>
          }
          noPad
        >
          {recentLeads.length === 0 ? (
            <div style={{ padding: 20 }}>
              <EmptyState title="No leads yet" description="Add your first lead to get started." />
            </div>
          ) : (
            recentLeads.map(l => (
              <div
                key={l.id}
                onClick={() => navigate(`/crm/leads/${l.id}`)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 20px', borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}
              >
                <div>
                  <div style={{ fontWeight: 500, fontSize: 13 }}>{l.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{l.company || l.email || '—'}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Badge label={l.status} />
                  {l.score != null && (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{l.score}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </SectionCard>

        <SectionCard title="Quick Actions" icon={Target}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <button className="btn btn-primary" onClick={() => navigate('/crm/leads?new=1')}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px 16px' }}>
              <Users size={15} /> New Lead
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/crm/deals?new=1')}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px 16px' }}>
              <Briefcase size={15} /> New Deal
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/crm/tasks?new=1')}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px 16px' }}>
              <CheckSquare size={15} /> New Task
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/crm/contacts?new=1')}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px 16px' }}>
              <AlertCircle size={15} /> New Contact
            </button>
          </div>

          <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
              Quick Links
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Pipeline Overview', to: '/crm/deals', icon: DollarSign },
                { label: 'All Opportunities', to: '/crm/opportunities', icon: TrendingUp },
                { label: 'Analytics', to: '/analytics', icon: BarChart2 },
              ].map(({ label, to, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)', padding: '6px 0', textDecoration: 'none' }}
                >
                  <Icon size={14} style={{ color: 'var(--accent)' }} />
                  {label}
                  <ArrowRight size={12} style={{ marginLeft: 'auto', opacity: 0.5 }} />
                </Link>
              ))}
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
