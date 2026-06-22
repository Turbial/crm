/**
 * Display a list of chips/tags, optionally removable.
 *
 * <ChipGroup chips={['email', 'sms']} />
 * <ChipGroup chips={events} onRemove={key => remove(key)} />
 * <ChipGroup chips={events} onAdd={() => setShowAdd(true)} addLabel="+ Event" />
 */
export default function ChipGroup({ chips = [], onRemove, onAdd, addLabel = '+ Add', color }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {chips.map((chip, i) => (
        <span
          key={chip + i}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: color ? undefined : 'var(--accent-soft)',
            color: color ? undefined : 'var(--accent)',
            border: `1px solid ${color || 'var(--accent)'}`,
            borderRadius: 999, padding: '2px 8px', fontSize: 11.5, fontWeight: 500,
          }}
        >
          {chip}
          {onRemove && (
            <button
              onClick={() => onRemove(chip)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '0 0 0 2px', color: 'inherit', opacity: .6, fontSize: 13, lineHeight: 1,
              }}
            >
              ×
            </button>
          )}
        </span>
      ))}
      {onAdd && (
        <button
          onClick={onAdd}
          style={{
            background: 'none', border: '1px dashed var(--border)', borderRadius: 999,
            padding: '2px 10px', fontSize: 11.5, color: 'var(--text-muted)',
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          {addLabel}
        </button>
      )}
    </div>
  )
}
