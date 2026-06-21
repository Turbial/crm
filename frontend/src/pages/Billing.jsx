import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CreditCard, FileText, Link as LinkIcon, Copy, Check } from 'lucide-react'
import { get, post } from '../api'
import Spinner from '../components/Spinner'
import Badge from '../components/Badge'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'

const fmtDate = d => d ? new Date(d).toLocaleString() : '—'

function fmtCurrency(amount, currency = 'usd') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(amount / 100)
}

function fmtCurrencyRaw(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase(), maximumFractionDigits: 0 }).format(amount)
}

const statusColor = {
  active: 'green',
  trialing: 'blue',
  past_due: 'yellow',
  cancelled: 'gray',
  canceled: 'gray',
}

const invoiceStatusColor = {
  paid: 'green',
  open: 'blue',
  void: 'gray',
  uncollectible: 'red',
}

const paymentLinkStatusColor = {
  active: 'green',
  expired: 'gray',
  used: 'blue',
}

function CopyUrlButton({ url }) {
  const [copied, setCopied] = useState(false)
  function handleCopy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button className="btn btn-ghost btn-icon btn-sm" onClick={handleCopy} title="Copy URL">
      {copied ? <Check size={13} color="var(--success)" /> : <Copy size={13} />}
    </button>
  )
}

function PaymentLinksTab() {
  const qc = useQueryClient()
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ description: '', amount: '', currency: 'USD', lead_id: '', expires_at: '' })

  const { data: links = [], isLoading } = useQuery({
    queryKey: ['billing-payment-links'],
    queryFn: () => get('/billing/payment-links', { limit: 50 }),
    retry: false,
  })

  const create = useMutation({
    mutationFn: () => post('/billing/payment-links', {
      description: form.description,
      amount: Number(form.amount),
      currency: form.currency,
      lead_id: form.lead_id || null,
      expires_at: form.expires_at || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['billing-payment-links'] })
      setShowNew(false)
      setForm({ description: '', amount: '', currency: 'USD', lead_id: '', expires_at: '' })
    },
  })

  if (isLoading) return <Spinner />

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
        <span />
        <button className="btn btn-primary" onClick={() => setShowNew(true)}>
          New Payment Link
        </button>
      </div>

      {links.length === 0 ? (
        <EmptyState
          icon={LinkIcon}
          title="No payment links yet"
          description="Create a payment link to share with a lead or customer."
        />
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Lead</th>
                  <th>Expires</th>
                  <th>URL</th>
                </tr>
              </thead>
              <tbody>
                {links.map(l => (
                  <tr key={l.id}>
                    <td className="font-medium">{l.description || '—'}</td>
                    <td>{fmtCurrencyRaw(l.amount, l.currency)}</td>
                    <td><Badge label={l.status} color={paymentLinkStatusColor[l.status] || 'gray'} /></td>
                    <td className="td-muted">{l.lead_id ? l.lead_id.slice(0, 8) : '—'}</td>
                    <td className="td-muted">{l.expires_at ? new Date(l.expires_at).toLocaleDateString() : '—'}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        {l.url
                          ? (
                            <>
                              <a href={l.url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" style={{ fontSize: 12 }}>
                                Open ↗
                              </a>
                              <CopyUrlButton url={l.url} />
                            </>
                          )
                          : <span className="td-muted">—</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={showNew}
        onClose={() => setShowNew(false)}
        title="New Payment Link"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowNew(false)}>Cancel</button>
            <button
              className="btn btn-primary"
              disabled={!form.description.trim() || !form.amount || create.isPending}
              onClick={() => create.mutate()}
            >
              {create.isPending ? 'Creating…' : 'Create'}
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Description *</label>
          <input
            className="form-input"
            autoFocus
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="e.g. Onboarding package"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Amount *</label>
          <input
            type="number"
            className="form-input"
            value={form.amount}
            onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
            placeholder="e.g. 500"
            min="0"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Currency</label>
          <input
            className="form-input"
            value={form.currency}
            onChange={e => setForm(f => ({ ...f, currency: e.target.value.toUpperCase() }))}
            placeholder="USD"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Lead ID (optional)</label>
          <input
            className="form-input"
            value={form.lead_id}
            onChange={e => setForm(f => ({ ...f, lead_id: e.target.value }))}
            placeholder="Lead UUID"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Expires At (optional)</label>
          <input
            type="date"
            className="form-input"
            value={form.expires_at}
            onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
          />
        </div>
        {create.isError && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{create.error?.message}</p>}
      </Modal>
    </div>
  )
}

export default function Billing() {
  const [tab, setTab] = useState('Subscription')
  const [showManage, setShowManage] = useState(false)

  const { data: sub, isLoading: subLoading, error: subError } = useQuery({
    queryKey: ['billing-subscription'],
    queryFn: () => get('/billing/subscription'),
    retry: (count, err) => {
      if (err?.message?.includes('404') || err?.message === 'HTTP 404') return false
      return count < 2
    },
  })

  const { data: invoices = [], isLoading: invLoading } = useQuery({
    queryKey: ['billing-invoices'],
    queryFn: () => get('/billing/invoices', { limit: 20 }),
  })

  const isLoading = subLoading || invLoading

  if (isLoading) return <Spinner />

  const noSub = !sub || subError

  const TABS = ['Subscription', 'Invoices', 'Payment Links']

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Billing &amp; Subscription</h1>
        </div>
      </div>

      <div className="flex gap-0" style={{ borderBottom: '1px solid var(--border-subtle)', marginBottom: 24 }}>
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="btn btn-ghost"
            style={{
              borderRadius: 0,
              borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
              color: tab === t ? 'var(--accent)' : 'var(--text-muted)',
              fontWeight: tab === t ? 600 : 400,
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Subscription' && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="flex gap-2 items-center" style={{ marginBottom: 16 }}>
            <CreditCard size={18} style={{ color: 'var(--text-muted)' }} />
            <h2 style={{ margin: 0, fontSize: 16 }}>Subscription</h2>
          </div>

          {noSub
            ? (
              <div style={{ color: 'var(--text-muted)', padding: '24px 0', textAlign: 'center' }}>
                <p className="font-medium">No active subscription</p>
                <p className="text-sm" style={{ marginTop: 4 }}>Contact support to set up your plan.</p>
              </div>
            )
            : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 20, marginBottom: 20 }}>
                <div>
                  <div className="text-xs td-muted" style={{ marginBottom: 4 }}>Plan</div>
                  <Badge label={sub.plan} color="blue" />
                </div>
                <div>
                  <div className="text-xs td-muted" style={{ marginBottom: 4 }}>Status</div>
                  <Badge label={sub.status} color={statusColor[sub.status] || 'gray'} />
                </div>
                <div>
                  <div className="text-xs td-muted" style={{ marginBottom: 4 }}>Current Period Ends</div>
                  <div className="font-medium text-sm">{fmtDate(sub.current_period_end)}</div>
                </div>
                <div>
                  <div className="text-xs td-muted" style={{ marginBottom: 4 }}>Seats</div>
                  <div className="font-medium text-sm">{sub.seats ?? '—'}</div>
                </div>
                <div>
                  <div className="text-xs td-muted" style={{ marginBottom: 4 }}>MRR</div>
                  <div className="font-medium text-sm">{sub.mrr != null ? fmtCurrency(sub.mrr) : '—'}</div>
                </div>
              </div>
            )}

          {!noSub && (
            <button className="btn btn-secondary btn-sm" onClick={() => setShowManage(true)}>
              Manage Subscription
            </button>
          )}
        </div>
      )}

      {tab === 'Invoices' && (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <div className="flex gap-2 items-center">
              <FileText size={18} style={{ color: 'var(--text-muted)' }} />
              <h2 style={{ margin: 0, fontSize: 16 }}>Invoices</h2>
            </div>
          </div>

          {invoices.length === 0
            ? (
              <div style={{ padding: 24 }}>
                <EmptyState
                  icon={FileText}
                  title="No invoices yet"
                  description="Your invoices will appear here once billing begins."
                />
              </div>
            )
            : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Period</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map(inv => (
                      <tr key={inv.id}>
                        <td className="text-sm">
                          {inv.period_start ? new Date(inv.period_start).toLocaleDateString() : '—'}
                          {' – '}
                          {inv.period_end ? new Date(inv.period_end).toLocaleDateString() : '—'}
                        </td>
                        <td className="font-medium">{fmtCurrency(inv.amount, inv.currency)}</td>
                        <td>
                          <Badge
                            label={inv.status}
                            color={invoiceStatusColor[inv.status] || 'gray'}
                          />
                        </td>
                        <td className="td-muted text-sm">{fmtDate(inv.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </div>
      )}

      {tab === 'Payment Links' && <PaymentLinksTab />}

      <Modal
        open={showManage}
        onClose={() => setShowManage(false)}
        title="Manage Subscription"
        footer={
          <button className="btn btn-secondary btn-sm" onClick={() => setShowManage(false)}>Close</button>
        }
      >
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <CreditCard size={36} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
          <p className="font-medium">Contact support to change plans</p>
          <p className="text-sm td-muted" style={{ marginTop: 8 }}>
            Reach out to <a href="mailto:support@example.com" style={{ color: 'var(--accent)' }}>support@example.com</a> to upgrade, downgrade, or cancel your subscription.
          </p>
        </div>
      </Modal>
    </div>
  )
}
