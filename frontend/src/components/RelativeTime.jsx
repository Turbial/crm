/**
 * Displays a relative time string ("2 hours ago", "3 days ago")
 * with the full timestamp in a tooltip.
 *
 * <RelativeTime date={item.created_at} />
 * <RelativeTime date={item.created_at} full /> — always shows full date
 */
export function relativeTime(d) {
  if (!d) return '—'
  const diff = Date.now() - new Date(d).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const days = Math.floor(h / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

export default function RelativeTime({ date, full }) {
  if (!date) return <span style={{ color: 'var(--text-muted)' }}>—</span>
  const d = new Date(date)
  const fullStr = d.toLocaleString()
  if (full) return <span title={fullStr}>{fullStr}</span>
  return <span title={fullStr} style={{ color: 'var(--text-muted)', fontSize: 12 }}>{relativeTime(date)}</span>
}
