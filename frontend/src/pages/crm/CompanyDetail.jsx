import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Edit2, Save, X, Building2, Users, Briefcase, Clock } from 'lucide-react'
import { get, patch, del } from '../../api'
import { Spinner, Badge, Timeline, TabBar, SectionCard, DataTable, MoneyDisplay, EmptyState } from '../../components'

const FIELDS = [
  ['name', 'Company Name', 'text'],
  ['domain', 'Domain', 'text'],
  ['industry', 'Industry', 'text'],
  ['size', 'Size', 'text'],
  ['website', 'Website', 'text'],
]

const TABS = [
  { key: 'overview', label: 'Overview', icon: Building2 },
  { key: 'people', label: 'People', icon: Users },
  { key: 'deals', label: 'Deals', icon: Briefcase },
  { key: 'timeline', label: 'Timeline', icon: Clock },
]

export default function CompanyDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [tab, setTab] = useState('overview')
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})

  const { data: company, isLoading } = useQuery({
    queryKey: ['company', id],
    queryFn: () => get(`/companies/${id}`),
  })

  const { data: leads = [] } = useQuery({
    queryKey: ['company-leads', id],
    queryFn: () => get(`/companies/${id}/leads`),
    enabled: !!company,
    retry: false,
  })

  const { data: contacts = [] } = useQuery({
    queryKey: ['company-contacts', id],
    queryFn: () => get(`/companies/${id}/contacts`),
    enabled: !!company,
    retry: false,
  })

  const { data: allDeals = [] } = useQuery({
    queryKey: ['all-deals-for-company'],
    queryFn: () => get('/deals', { limit: 100 }),
    enabled: !!company,
    retry: false,
  })

  const { data: timeline = [] } = useQuery({
    queryKey: ['timeline', 'company', id],
    queryFn: () => get(`/companies/${id}/timeline`),
    enabled: !!company,
    retry: false,
  })

  const update = useMutation({
    mutationFn: body => patch(`/companies/${id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['company', id] }); setEditing(false) },
  })

  const remove = useMutation({
    mutationFn: () => del(`/companies/${id}`),
    onSuccess: () => navigate('/crm/companies'),
  })

  if (isLoading) return <Spinner />
  if (!company) return <p className="text-muted">Company not found.</p>

  // Filter deals for this company client-side
  const companyDeals = allDeals.filter(d =>
    d.company_id === id ||
    d.company_id === company.id ||
    d.company === company.name
  )

  function startEdit() {
    setForm({ name: company.name, domain: company.domain, industry: company.industry, size: company.size, website: company.website })
    setEditing(true)
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button className="btn btn-ghost btn-icon" onClick={() => navigate(-1)}><ArrowLeft size={16} /></button>
        <h1 style={{ fontSize: 20, fontWeight: 700, flex: 1 }}>{company.name}</h1>
        {!editing && tab === 'overview' && (
          <button className="btn btn-secondary btn-sm flex gap-1 items-center" onClick={startEdit}>
            <Edit2 size={13} /> Edit
          </button>
        )}
      </div>

      <TabBar tabs={TABS} active={tab} onChange={setTab} variant="underline" />

      {/* OVERVIEW TAB */}
      {tab === 'overview' && (
        <div className="two-col">
          <div className="card">
            <h3 className="font-semibold" style={{ fontSize: 14, marginBottom: 16 }}>Company Details</h3>

            {editing ? (
              <div>
                {FIELDS.map(([k, label, type]) => (
                  <div key={k} className="form-group">
                    <label className="form-label">{label}</label>
                    <input className="form-input" type={type} value={form[k] || ''} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />
                  </div>
                ))}
                <div className="flex gap-2 mt-4">
                  <button className="btn btn-primary btn-sm flex gap-1 items-center" disabled={update.isPending} onClick={() => update.mutate(form)}>
                    <Save size={13} /> {update.isPending ? 'Saving…' : 'Save'}
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setEditing(false)}><X size={13} /> Cancel</button>
                </div>
                {update.isError && <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 8 }}>{update.error?.message}</p>}
              </div>
            ) : (
              <div>
                {FIELDS.map(([k, label]) => (
                  <div key={k} className="flex justify-between" style={{ fontSize: 13, padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                    <span className="font-medium">
                      {k === 'website' && company[k]
                        ? <a href={company[k]} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }} onClick={e => e.stopPropagation()}>{company[k]}</a>
                        : company[k] || '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <button
              className="btn btn-danger btn-sm"
              style={{ marginTop: 24 }}
              onClick={() => { if (window.confirm(`Delete "${company.name}"?`)) remove.mutate() }}
            >
              Delete Company
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Summary counts */}
            <div className="card">
              <h3 className="font-semibold" style={{ fontSize: 14, marginBottom: 12 }}>Summary</h3>
              <div style={{ display: 'flex', gap: 24 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent)' }}>{leads.length}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Leads</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent)' }}>{contacts.length}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Contacts</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent)' }}>{companyDeals.length}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Deals</div>
                </div>
              </div>
            </div>

            {/* Quick leads preview */}
            <div className="card" style={{ padding: 0 }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 className="font-semibold" style={{ fontSize: 14, margin: 0 }}>Leads ({leads.length})</h3>
                {leads.length > 0 && (
                  <button className="btn btn-ghost btn-sm" style={{ fontSize: 12 }} onClick={() => setTab('people')}>View all</button>
                )}
              </div>
              {leads.length === 0
                ? <p className="text-muted text-sm" style={{ padding: 16 }}>No leads linked.</p>
                : leads.slice(0, 3).map(l => (
                  <div key={l.id} className="flex items-center justify-between" style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                    onClick={() => navigate(`/crm/leads/${l.id}`)}>
                    <div>
                      <div className="text-sm font-medium">{l.name}</div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{l.email}</div>
                    </div>
                    <Badge label={l.status} />
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* PEOPLE TAB */}
      {tab === 'people' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Contacts section */}
          <SectionCard title={`Contacts (${contacts.length})`} icon={Users}>
            {contacts.length === 0 ? (
              <EmptyState title="No contacts" description="No contacts linked to this company yet." />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                {contacts.map(c => (
                  <Link
                    key={c.id}
                    to={`/crm/contacts/${c.id}`}
                    style={{ textDecoration: 'none' }}
                  >
                    <div
                      style={{
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 8,
                        padding: 14,
                        cursor: 'pointer',
                        transition: 'border-color 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
                    >
                      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 4 }}>
                        {c.name}
                      </div>
                      {c.title && (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{c.title}</div>
                      )}
                      {c.email && (
                        <div style={{ fontSize: 12, color: 'var(--accent)' }}>{c.email}</div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Leads section */}
          <SectionCard title={`Leads (${leads.length})`} icon={Users} noPad>
            {leads.length === 0 ? (
              <div style={{ padding: 20 }}>
                <EmptyState title="No leads" description="No leads linked to this company yet." />
              </div>
            ) : (
              leads.map(l => (
                <div
                  key={l.id}
                  onClick={() => navigate(`/crm/leads/${l.id}`)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 20px', borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                >
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{l.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{l.email || '—'}</div>
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
        </div>
      )}

      {/* DEALS TAB */}
      {tab === 'deals' && (
        <SectionCard title={`Deals (${companyDeals.length})`} icon={Briefcase} noPad>
          {companyDeals.length === 0 ? (
            <div style={{ padding: 20 }}>
              <EmptyState title="No deals" description="No deals are linked to this company." />
            </div>
          ) : (
            <DataTable
              data={companyDeals}
              emptyTitle="No deals"
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
                  key: 'owner',
                  label: 'Rep',
                  render: row => row.owner_name || row.assigned_to || '—',
                  className: 'td-muted text-sm',
                },
              ]}
              onRowClick={row => navigate(`/crm/deals/${row.id}`)}
            />
          )}
        </SectionCard>
      )}

      {/* TIMELINE TAB */}
      {tab === 'timeline' && (
        <div className="card">
          <h3 className="font-semibold" style={{ fontSize: 14, marginBottom: 16 }}>Activity Timeline</h3>
          <Timeline events={timeline} />
        </div>
      )}
    </div>
  )
}
