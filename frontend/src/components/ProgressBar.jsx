export default function ProgressBar({
  value,
  max,
  color = 'var(--accent)',
  height = 8,
  showLabel,
  label,
  style,
}) {
  const pct = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0
  return (
    <div style={style}>
      {(showLabel || label) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12, color: 'var(--text-muted)' }}>
          <span>{label ?? ''}</span>
          <span>{pct}%</span>
        </div>
      )}
      <div style={{ background: 'var(--border-subtle)', borderRadius: 4, height, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width .3s' }} />
      </div>
    </div>
  )
}
