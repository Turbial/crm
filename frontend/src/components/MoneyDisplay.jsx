/**
 * Format and display a monetary value.
 *
 * <MoneyDisplay amount={deal.value} currency="USD" />
 * <MoneyDisplay amount={invoice.amount} currency="usd" cents />   ← amount is in cents
 */
export function formatMoney(amount, currency = 'USD', cents = false) {
  if (amount == null) return '—'
  const value = cents ? amount / 100 : amount
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    maximumFractionDigits: cents ? 2 : 0,
  }).format(value)
}

export default function MoneyDisplay({ amount, currency = 'USD', cents = false, color, style }) {
  return (
    <span style={{ fontWeight: 500, color: color || 'var(--success)', ...style }}>
      {formatMoney(amount, currency, cents)}
    </span>
  )
}
