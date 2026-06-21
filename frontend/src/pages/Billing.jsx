import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CreditCard, FileText } from 'lucide-react'
import { get } from '../api'
import Spinner from '../components/Spinner'
import Badge from '../components/Badge'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'

const fmtDate = d => d ? new Date(d).toLocaleString() : '—'

function fmtCurrency(amount, currency = 'usd') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(amount / 100)
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

export default function Billing() {
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

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Billing &amp; Subscription</h1>
        </div>
      </div>

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
