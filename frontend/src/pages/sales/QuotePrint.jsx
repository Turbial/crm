import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Printer } from 'lucide-react'
import { get } from '../../api'
import { Spinner, Badge } from '../../components'

function lineTotal(item) {
  return (Number(item.qty)||0) * (Number(item.unit_price)||0) * (1 - (Number(item.discount_pct)||0)/100)
}

function calcSubtotal(items) { return items.reduce((s,it) => s + lineTotal(it), 0) }

function parseItems(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  try { return JSON.parse(raw) } catch { return [] }
}

function fmtMoney(n) { return new Intl.NumberFormat('en-US', {style:'currency',currency:'USD'}).format(n||0) }

function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-US', {year:'numeric',month:'long',day:'numeric'}) : '—' }

const STATUS_COLORS = {
  draft:    'gray',
  sent:     'blue',
  accepted: 'green',
  rejected: 'red',
}

export default function QuotePrint() {
  const { id } = useParams()
  const navigate = useNavigate()

  const { data: quote, isLoading: quoteLoading } = useQuery({
    queryKey: ['quote', id],
    queryFn: () => get(`/quotes/${id}`),
  })

  const { data: lead, isLoading: leadLoading } = useQuery({
    queryKey: ['lead', quote?.lead_id],
    queryFn: () => get(`/leads/${quote.lead_id}`),
    enabled: !!quote?.lead_id,
    retry: false,
  })

  if (quoteLoading || leadLoading) return <Spinner />
  if (!quote) return <p className="text-muted">Quote not found.</p>

  const items = parseItems(quote.items ?? quote.line_items)
  const subtotal = calcSubtotal(items)
  const taxAmt = subtotal * (Number(quote.tax_pct) || 0) / 100
  const total = subtotal + taxAmt

  return (
    <div style={{ maxWidth: 780, margin: '0 auto', padding: '0 0 40px' }}>

      <div
        className="no-print"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '16px 0 24px',
          flexWrap: 'wrap',
        }}
      >
        <button
          className="btn btn-ghost btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)' }}
          onClick={() => navigate(-1)}
        >
          <ArrowLeft size={15} /> Back
        </button>
        <span style={{ flex: 1, fontWeight: 600, fontSize: 16, color: 'var(--text)' }}>
          {quote.title || 'Untitled Quote'}
        </span>
        <Badge label={quote.status} color={STATUS_COLORS[quote.status] || 'gray'} />
        <button
          className="btn btn-primary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          onClick={() => window.print()}
        >
          <Printer size={14} /> Print / Save PDF
        </button>
      </div>

      <div style={{
        background: '#fff',
        border: '1px solid var(--border)',
        borderRadius: 12,
        overflow: 'hidden',
      }}>

        <div style={{
          background: 'var(--sidebar-bg)',
          padding: '32px 36px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 16,
              color: 'var(--sidebar-bg)',
              flexShrink: 0,
              letterSpacing: 1,
            }}>
              MO
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 18, color: '#fff', lineHeight: 1.2 }}>MightyOps CRM</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>Your growth partner</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: 2, lineHeight: 1 }}>QUOTE</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 6, fontFamily: 'monospace' }}>
              #{id.slice(0, 8).toUpperCase()}
            </div>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 0,
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ padding: '28px 36px', borderRight: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 12 }}>
              Bill To
            </div>
            {lead ? (
              <>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 4 }}>{lead.name}</div>
                {lead.company && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 3 }}>{lead.company}</div>}
                {lead.email && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 3 }}>{lead.email}</div>}
                {lead.phone && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{lead.phone}</div>}
              </>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>—</div>
            )}
          </div>
          <div style={{ padding: '28px 36px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 12 }}>
              Quote Details
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)', paddingBottom: 6, paddingRight: 16, whiteSpace: 'nowrap' }}>Date Issued</td>
                  <td style={{ fontSize: 13, fontWeight: 500, paddingBottom: 6 }}>{fmtDate(quote.created_at)}</td>
                </tr>
                <tr>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)', paddingBottom: 6, paddingRight: 16, whiteSpace: 'nowrap' }}>Valid Until</td>
                  <td style={{ fontSize: 13, fontWeight: 500, paddingBottom: 6 }}>{fmtDate(quote.valid_until)}</td>
                </tr>
                <tr>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)', paddingRight: 16, whiteSpace: 'nowrap' }}>Status</td>
                  <td style={{ fontSize: 13, fontWeight: 500 }}>
                    <span style={{ textTransform: 'capitalize' }}>{quote.status}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ padding: '28px 36px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 14 }}>
            Line Items
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 600, fontSize: 11, letterSpacing: 0.5, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', width: 32 }}>#</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 600, fontSize: 11, letterSpacing: 0.5, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>Item</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 600, fontSize: 11, letterSpacing: 0.5, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>Description</th>
                <th style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 600, fontSize: 11, letterSpacing: 0.5, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', width: 56 }}>Qty</th>
                <th style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 600, fontSize: 11, letterSpacing: 0.5, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', width: 100 }}>Unit Price</th>
                <th style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 600, fontSize: 11, letterSpacing: 0.5, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', width: 72 }}>Disc %</th>
                <th style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 600, fontSize: 11, letterSpacing: 0.5, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', width: 110 }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    No line items.
                  </td>
                </tr>
              ) : items.map((item, idx) => (
                <tr
                  key={idx}
                  style={{ background: idx % 2 === 0 ? '#fff' : '#fafbff' }}
                >
                  <td style={{ padding: '11px 12px', color: 'var(--text-muted)', fontSize: 12, borderBottom: '1px solid #f1f5f9' }}>
                    {idx + 1}
                  </td>
                  <td style={{ padding: '11px 12px', fontWeight: 600, color: 'var(--text)', borderBottom: '1px solid #f1f5f9' }}>
                    {item.name || '—'}
                  </td>
                  <td style={{ padding: '11px 12px', color: 'var(--text-muted)', borderBottom: '1px solid #f1f5f9' }}>
                    {item.description || ''}
                  </td>
                  <td style={{ padding: '11px 12px', textAlign: 'right', fontFamily: 'monospace', borderBottom: '1px solid #f1f5f9' }}>
                    {Number(item.qty) || 0}
                  </td>
                  <td style={{ padding: '11px 12px', textAlign: 'right', fontFamily: 'monospace', borderBottom: '1px solid #f1f5f9' }}>
                    {fmtMoney(item.unit_price)}
                  </td>
                  <td style={{ padding: '11px 12px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-muted)', borderBottom: '1px solid #f1f5f9' }}>
                    {Number(item.discount_pct) > 0 ? `${item.discount_pct}%` : '—'}
                  </td>
                  <td style={{ padding: '11px 12px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', borderBottom: '1px solid #f1f5f9' }}>
                    {fmtMoney(lineTotal(item))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ padding: '24px 36px', borderBottom: quote.notes ? '1px solid var(--border)' : 'none', display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ width: 280 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Subtotal</span>
              <span style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 500 }}>{fmtMoney(subtotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Tax ({Number(quote.tax_pct) || 0}%)</span>
              <span style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 500 }}>{fmtMoney(taxAmt)}</span>
            </div>
            <div style={{
              borderTop: '2px solid var(--border)',
              paddingTop: 12,
              marginTop: 4,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
            }}>
              <span style={{ fontWeight: 700, fontSize: 14, textTransform: 'uppercase', letterSpacing: 0.5 }}>Total</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)', fontFamily: 'monospace' }}>
                {fmtMoney(total)}
              </span>
            </div>
          </div>
        </div>

        {quote.notes && (
          <div style={{ padding: '24px 36px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10 }}>
              Notes
            </div>
            <div style={{
              background: '#f8fafc',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '14px 16px',
              fontSize: 13,
              color: 'var(--text)',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
            }}>
              {quote.notes}
            </div>
          </div>
        )}

        <div style={{
          padding: '28px 36px',
          textAlign: 'center',
          background: '#fafbff',
        }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 6 }}>
            Thank you for your business!
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            MightyOps CRM — Empowering teams to grow smarter and faster.
          </div>
        </div>

      </div>
    </div>
  )
}
