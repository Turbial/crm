/**
 * Key-value detail row for modals and sidebar detail panels.
 *
 * <DetailRow label="Email" value={contact.email} mono />
 * <DetailRow label="Status"><Badge label={status} /></DetailRow>
 */
export default function DetailRow({ label, value, mono, children, style }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, ...style }}>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.04em' }}>
        {label}
      </span>
      {children ?? (
        <span
          style={{
            fontSize: 13.5,
            fontWeight: 500,
            fontFamily: mono ? 'monospace' : undefined,
          }}
        >
          {value ?? '—'}
        </span>
      )}
    </div>
  )
}
