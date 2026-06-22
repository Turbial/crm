/**
 * Small pill showing an entity type + short ID — used in tables and detail panels.
 *
 * <EntityChip type="contact" id={contact_id} />
 * → renders:  contact/a1b2c3d4
 */
export default function EntityChip({ type, id, truncate = 8 }) {
  if (!type && !id) return <span style={{ color: 'var(--text-muted)' }}>—</span>

  return (
    <span
      style={{
        fontSize: 11,
        padding: '2px 8px',
        borderRadius: 10,
        background: 'var(--bg)',
        color: 'var(--text-muted)',
        fontFamily: 'monospace',
        border: '1px solid var(--border)',
        whiteSpace: 'nowrap',
      }}
    >
      {type && <>{type}{id ? '/' : ''}</>}
      {id && String(id).slice(0, truncate)}
    </span>
  )
}
