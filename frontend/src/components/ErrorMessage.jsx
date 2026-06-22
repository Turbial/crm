/**
 * Inline error / warning / info message block.
 *
 * <ErrorMessage error={mutation.error} />
 * <ErrorMessage message="Custom message" type="warning" />
 */
export default function ErrorMessage({ error, message, type = 'error' }) {
  const text = message || error?.message || (typeof error === 'string' ? error : null)
  if (!text) return null

  const colors = {
    error:   { bg: 'var(--danger-soft)',  color: 'var(--danger)' },
    warning: { bg: 'var(--warning-soft)', color: 'var(--warning)' },
    info:    { bg: 'var(--accent-soft)',  color: 'var(--accent)' },
  }
  const c = colors[type] || colors.error

  return (
    <p
      style={{
        fontSize: 13,
        padding: '8px 12px',
        borderRadius: 6,
        background: c.bg,
        color: c.color,
        margin: 0,
      }}
    >
      {text}
    </p>
  )
}
