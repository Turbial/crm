import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Trash2, Save, Send, CheckCircle, XCircle, CreditCard, AlertTriangle } from 'lucide-react'
import { get, post, patch, del } from '../../api'
import {
  Spinner, Badge, Modal, SectionCard, FormField, ErrorMessage,
  ConfirmDialog, MoneyDisplay, formatMoney, DetailRow, CopyButton,
  Toast, useToast,
} from '../../components'

// ── Helpers ──────────────────────────────────────────────────────────────────

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)
}

const STATUS_COLORS = {
  draft:    'gray',
  sent:     'blue',
  accepted: 'green',
  rejected: 'red',
}

function lineTotal(item) {
  const qty        = Number(item.qty)        || 0
  const unit_price = Number(item.unit_price) || 0
  const disc       = Number(item.discount_pct) || 0
  return qty * unit_price * (1 - disc / 100)
}

function calcSubtotal(items) {
  return items.reduce((s, it) => s + lineTotal(it), 0)
}

function calcTotal(subtotal, taxPct) {
  return subtotal * (1 + (Number(taxPct) || 0) / 100)
}

function parseItems(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  try { return JSON.parse(raw) } catch { return [] }
}

// ── Editable cell ─────────────────────────────────────────────────────────────

function Cell({ value, onChange, type = 'text', placeholder, disabled, align = 'left', min, step }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      min={min}
      step={step}
      style={{
        width: '100%',
        background: disabled ? 'transparent' : 'var(--surface)',
        border: disabled ? 'none' : '1px solid var(--border)',
        borderRadius: 5,
        padding: '5px 8px',
        fontSize: 13,
        fontFamily: type === 'number' ? 'monospace' : undefined,
        textAlign: align,
        color: 'var(--text)',
        outline: 'none',
        boxSizing: 'border-box',
      }}
    />
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function QuoteDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()

  // ── Remote data ────────────────────────────────────────────────────────────
  const { data: quote, isLoading } = useQuery({
    queryKey: ['quote', id],
    queryFn: () => get(`/quotes/${id}`),
  })

  const { data: linkedLead } = useQuery({
    queryKey: ['lead', quote?.lead_id],
    queryFn: () => get(`/leads/${quote.lead_id}`),
    enabled: !!quote?.lead_id,
    retry: false,
  })

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => get('/products'),
  })

  // ── Local state ────────────────────────────────────────────────────────────
  const [title,     setTitle]     = useState('')
  const [items,     setItems]     = useState([])
  const [taxPct,    setTaxPct]    = useState(0)
  const [deleteOpen,    setDeleteOpen]    = useState(false)
  const [payLinkOpen,   setPayLinkOpen]   = useState(false)
  const [payLinkUrl,    setPayLinkUrl]    = useState('')
  const [productPickerOpen, setProductPickerOpen] = useState(false)
  const [pickerTarget,      setPickerTarget]      = useState(null) // row index to fill

  const [toast, showToast] = useToast()

  // Sync server → local when quote loads
  useEffect(() => {
    if (!quote) return
    setTitle(quote.title || '')
    setItems(parseItems(quote.line_items))
    setTaxPct(0)
  }, [quote])

  // ── Computed totals ────────────────────────────────────────────────────────
  const subtotal = calcSubtotal(items)
  const totalDiscountAmt = items.reduce((s, it) => {
    const gross = (Number(it.qty) || 0) * (Number(it.unit_price) || 0)
    return s + gross * (Number(it.discount_pct) || 0) / 100
  }, 0)
  const total = calcTotal(subtotal, taxPct)

  const isReadOnly = quote?.status === 'rejected'

  // ── Mutations ──────────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: body => patch(`/quotes/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quote', id] })
      showToast('Quote saved', 'success')
    },
    onError: err => showToast(err?.message || 'Save failed', 'error'),
  })

  const statusMutation = useMutation({
    mutationFn: status => patch(`/quotes/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quote', id] }),
    onError: err => showToast(err?.message || 'Failed to update status', 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => del(`/quotes/${id}`),
    onSuccess: () => navigate('/sales/quotes'),
  })

  const payLinkMutation = useMutation({
    mutationFn: () => post('/billing/payment-links', {
      description: quote.title,
      amount: total,
      lead_id: quote.lead_id,
      currency: 'USD',
    }),
    onSuccess: data => {
      const url = data?.url || data?.payment_url || data?.link || JSON.stringify(data)
      setPayLinkUrl(url)
      setPayLinkOpen(true)
    },
    onError: err => showToast(err?.message || 'Failed to create payment link', 'error'),
  })

  // ── Line item handlers ─────────────────────────────────────────────────────
  function addItem() {
    setItems(prev => [
      ...prev,
      { id: uuid(), name: '', description: '', qty: 1, unit_price: 0, discount_pct: 0, line_total: 0 },
    ])
  }

  function removeItem(idx) {
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  const updateItem = useCallback((idx, field, value) => {
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it
      const updated = { ...it, [field]: value }
      updated.line_total = lineTotal(updated)
      return updated
    }))
  }, [])

  function openProductPicker(idx) {
    setPickerTarget(idx)
    setProductPickerOpen(true)
  }

  function pickProduct(product) {
    if (pickerTarget === null) return
    setItems(prev => prev.map((it, i) => {
      if (i !== pickerTarget) return it
      const updated = {
        ...it,
        name: product.name,
        description: product.description || '',
        unit_price: product.price || 0,
      }
      updated.line_total = lineTotal(updated)
      return updated
    }))
    setProductPickerOpen(false)
    setPickerTarget(null)
  }

  function handleSave() {
    const lineItems = items.map(it => ({ ...it, line_total: lineTotal(it) }))
    saveMutation.mutate({
      title,
      line_items: lineItems,
      subtotal,
      total,
    })
  }

  // ── Early return ───────────────────────────────────────────────────────────
  if (isLoading) return <Spinner />
  if (!quote) return <p className="text-muted">Quote not found.</p>

  // ── Status action bar ──────────────────────────────────────────────────────
  function renderStatusActions() {
    const s = quote.status

    if (s === 'draft') {
      return (
        <div className="flex gap-2 items-center">
          <button
            className="btn btn-primary flex gap-1 items-center"
            disabled={statusMutation.isPending}
            onClick={() => statusMutation.mutate('sent')}
          >
            <Send size={14} /> {statusMutation.isPending ? 'Sending…' : 'Send Quote →'}
          </button>
        </div>
      )
    }

    if (s === 'sent') {
      return (
        <div className="flex gap-2 items-center">
          <button
            className="btn btn-primary flex gap-1 items-center"
            disabled={statusMutation.isPending}
            onClick={() => statusMutation.mutate('accepted')}
          >
            <CheckCircle size={14} /> Mark Accepted
          </button>
          <button
            className="btn btn-danger flex gap-1 items-center"
            disabled={statusMutation.isPending}
            onClick={() => statusMutation.mutate('rejected')}
          >
            <XCircle size={14} /> Mark Rejected
          </button>
        </div>
      )
    }

    if (s === 'accepted') {
      return (
        <div className="flex gap-2 items-center">
          <button
            className="btn btn-primary flex gap-1 items-center"
            disabled={payLinkMutation.isPending}
            onClick={() => payLinkMutation.mutate()}
          >
            <CreditCard size={14} /> {payLinkMutation.isPending ? 'Creating…' : 'Create Payment Link'}
          </button>
        </div>
      )
    }

    if (s === 'rejected') {
      return (
        <div
          className="flex gap-2 items-center"
          style={{
            background: 'var(--danger-soft)',
            border: '1px solid #fca5a5',
            borderRadius: 8,
            padding: '8px 14px',
            fontSize: 13,
            color: 'var(--danger)',
          }}
        >
          <AlertTriangle size={14} style={{ flexShrink: 0 }} />
          This quote was rejected and is read-only.
        </div>
      )
    }

    return null
  }

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 980, margin: '0 auto' }}>

      {/* Toast */}
      {toast.message && (
        <div style={{ marginBottom: 16 }}>
          <Toast {...toast} />
        </div>
      )}

      {/* Top nav */}
      <button
        className="btn btn-ghost btn-sm flex gap-1 items-center"
        style={{ marginBottom: 20, color: 'var(--text-muted)' }}
        onClick={() => navigate('/sales/quotes')}
      >
        <ArrowLeft size={15} /> Quotes
      </button>

      {/* Header row: title + status */}
      <div className="flex items-center gap-3" style={{ marginBottom: 6, flexWrap: 'wrap' }}>
        {isReadOnly ? (
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, flex: 1 }}>{title || 'Untitled Quote'}</h1>
        ) : (
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Quote title…"
            style={{
              fontSize: 24,
              fontWeight: 700,
              flex: 1,
              background: 'transparent',
              border: 'none',
              borderBottom: '2px solid var(--border)',
              outline: 'none',
              padding: '2px 0',
              color: 'var(--text)',
              minWidth: 0,
            }}
          />
        )}
        <Badge label={quote.status} color={STATUS_COLORS[quote.status] || 'gray'} />
      </div>

      {/* Sub-header: lead + date */}
      <div className="flex gap-4 items-center" style={{ marginBottom: 24, fontSize: 13, color: 'var(--text-muted)' }}>
        <span>
          Lead:{' '}
          {linkedLead
            ? <Link to={`/crm/leads/${quote.lead_id}`} style={{ color: 'var(--accent)' }}>{linkedLead.name}</Link>
            : quote.lead_id
              ? <span style={{ color: 'var(--accent)' }}>{quote.lead_id}</span>
              : '—'}
        </span>
        <span>Created: {quote.created_at ? new Date(quote.created_at).toLocaleDateString() : '—'}</span>
      </div>

      {/* Status actions */}
      <div style={{ marginBottom: 24 }}>
        {renderStatusActions()}
      </div>

      {/* Line items */}
      <SectionCard
        title="Line Items"
        style={{ marginBottom: 20 }}
        noPad
        action={
          !isReadOnly && (
            <button
              className="btn btn-secondary btn-sm flex gap-1 items-center"
              style={{ margin: '10px 16px 10px 0' }}
              onClick={addItem}
            >
              <Plus size={13} /> Add Line Item
            </button>
          )
        }
      >
        <div className="table-wrap">
          <table style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: '36%' }}>Item / Description</th>
                <th style={{ width: '8%',  textAlign: 'right' }}>Qty</th>
                <th style={{ width: '16%', textAlign: 'right' }}>Unit Price</th>
                <th style={{ width: '12%', textAlign: 'right' }}>Discount %</th>
                <th style={{ width: '16%', textAlign: 'right' }}>Line Total</th>
                {!isReadOnly && <th style={{ width: '5%' }} />}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={isReadOnly ? 5 : 6} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: 13 }}>
                    No line items yet.
                    {!isReadOnly && (
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ marginLeft: 8 }}
                        onClick={addItem}
                      >
                        Add one
                      </button>
                    )}
                  </td>
                </tr>
              )}
              {items.map((item, idx) => (
                <tr key={item.id || idx}>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <Cell
                          value={item.name}
                          onChange={e => updateItem(idx, 'name', e.target.value)}
                          placeholder="Product name"
                          disabled={isReadOnly}
                        />
                        {!isReadOnly && products.length > 0 && (
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ flexShrink: 0, fontSize: 11, padding: '4px 6px' }}
                            onClick={() => openProductPicker(idx)}
                            title="Pick from products"
                          >
                            Pick
                          </button>
                        )}
                      </div>
                      <Cell
                        value={item.description}
                        onChange={e => updateItem(idx, 'description', e.target.value)}
                        placeholder="Description (optional)"
                        disabled={isReadOnly}
                      />
                    </div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <Cell
                      type="number"
                      value={item.qty}
                      onChange={e => updateItem(idx, 'qty', e.target.value)}
                      min="0"
                      step="1"
                      align="right"
                      disabled={isReadOnly}
                    />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <Cell
                      type="number"
                      value={item.unit_price}
                      onChange={e => updateItem(idx, 'unit_price', e.target.value)}
                      min="0"
                      step="0.01"
                      align="right"
                      placeholder="0"
                      disabled={isReadOnly}
                    />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <Cell
                      type="number"
                      value={item.discount_pct}
                      onChange={e => updateItem(idx, 'discount_pct', e.target.value)}
                      min="0"
                      max="100"
                      step="0.1"
                      align="right"
                      placeholder="0"
                      disabled={isReadOnly}
                    />
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600, fontFamily: 'monospace', fontSize: 13 }}>
                    {formatMoney(lineTotal(item))}
                  </td>
                  {!isReadOnly && (
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="btn btn-ghost btn-icon btn-sm"
                        onClick={() => removeItem(idx)}
                        title="Remove line item"
                        style={{ color: 'var(--danger)' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Totals */}
      <SectionCard title="Totals" style={{ marginBottom: 24 }}>
        <div style={{ maxWidth: 320, marginLeft: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="flex justify-between" style={{ fontSize: 13 }}>
            <span style={{ color: 'var(--text-muted)' }}>Subtotal</span>
            <span style={{ fontWeight: 500, fontFamily: 'monospace' }}>{formatMoney(subtotal)}</span>
          </div>

          {totalDiscountAmt > 0 && (
            <div className="flex justify-between" style={{ fontSize: 13 }}>
              <span style={{ color: 'var(--text-muted)' }}>Discount (total)</span>
              <span style={{ fontWeight: 500, fontFamily: 'monospace', color: 'var(--danger)' }}>
                -{formatMoney(totalDiscountAmt)}
              </span>
            </div>
          )}

          <div className="flex justify-between items-center" style={{ fontSize: 13 }}>
            <span style={{ color: 'var(--text-muted)' }}>Tax (%)</span>
            {isReadOnly ? (
              <span style={{ fontFamily: 'monospace' }}>{taxPct}%</span>
            ) : (
              <input
                type="number"
                value={taxPct}
                onChange={e => setTaxPct(e.target.value)}
                min="0"
                max="100"
                step="0.1"
                style={{
                  width: 70,
                  textAlign: 'right',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 5,
                  padding: '4px 8px',
                  fontSize: 13,
                  fontFamily: 'monospace',
                  color: 'var(--text)',
                }}
              />
            )}
          </div>

          <div
            style={{
              borderTop: '2px solid var(--border)',
              paddingTop: 12,
              marginTop: 4,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
            }}
          >
            <span style={{ fontWeight: 700, fontSize: 15 }}>Total</span>
            <MoneyDisplay
              amount={total}
              style={{ fontSize: 22, fontWeight: 700, color: 'var(--success)' }}
            />
          </div>
        </div>
      </SectionCard>

      {/* Save + Delete */}
      {!isReadOnly && (
        <div className="flex gap-3 items-center" style={{ marginBottom: 40 }}>
          <button
            className="btn btn-primary flex gap-1 items-center"
            disabled={saveMutation.isPending}
            onClick={handleSave}
          >
            <Save size={14} /> {saveMutation.isPending ? 'Saving…' : 'Save Quote'}
          </button>
          <button
            className="btn btn-danger btn-sm flex gap-1 items-center"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 size={13} /> Delete Quote
          </button>
          {saveMutation.isError && (
            <ErrorMessage error={saveMutation.error} />
          )}
        </div>
      )}

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete Quote"
        message={`Delete "${quote.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />

      {/* Payment link modal */}
      <Modal
        open={payLinkOpen}
        onClose={() => setPayLinkOpen(false)}
        title="Payment Link Created"
        footer={
          <button className="btn btn-primary" onClick={() => setPayLinkOpen(false)}>Done</button>
        }
      >
        <p style={{ fontSize: 13, marginBottom: 12, color: 'var(--text-muted)' }}>
          Share this link with your customer to collect payment of{' '}
          <strong>{formatMoney(total)}</strong>.
        </p>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--surface-raised, var(--surface))',
            border: '1px solid var(--border)',
            borderRadius: 7,
            padding: '8px 12px',
          }}
        >
          <span
            style={{
              flex: 1,
              fontSize: 13,
              fontFamily: 'monospace',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: 'var(--accent)',
            }}
          >
            {payLinkUrl}
          </span>
          <CopyButton text={payLinkUrl} label="Copy" />
        </div>
      </Modal>

      {/* Product picker modal */}
      <Modal
        open={productPickerOpen}
        onClose={() => { setProductPickerOpen(false); setPickerTarget(null) }}
        title="Select a Product"
      >
        {products.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No products available.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 360, overflowY: 'auto' }}>
            {products.map(p => (
              <button
                key={p.id}
                className="btn btn-ghost"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  textAlign: 'left',
                  padding: '10px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: 7,
                }}
                onClick={() => pickProduct(p)}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                  {p.description && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      {p.description.slice(0, 80)}
                    </div>
                  )}
                </div>
                <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--success)', flexShrink: 0, marginLeft: 12 }}>
                  {formatMoney(p.price)}
                </span>
              </button>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}
