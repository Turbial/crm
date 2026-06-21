/**
 * Two variants:
 *   variant="pill"       — pill tabs on a subtle background (default, matches .tab-bar/.tab-item)
 *   variant="underline"  — underline tabs on a bottom border (like Billing page)
 *
 * tabs: [{ key, label, icon? }]
 */
export default function TabBar({ tabs, active, onChange, variant = 'pill', style }) {
  if (variant === 'underline') {
    return (
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-subtle)',
          marginBottom: 24,
          gap: 0,
          ...style,
        }}
      >
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className="btn btn-ghost"
            style={{
              borderRadius: 0,
              borderBottom: active === t.key ? '2px solid var(--accent)' : '2px solid transparent',
              color: active === t.key ? 'var(--accent)' : 'var(--text-muted)',
              fontWeight: active === t.key ? 600 : 400,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {t.icon && <t.icon size={14} />}
            {t.label}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="tab-bar" style={{ marginBottom: 20, ...style }}>
      {tabs.map(t => (
        <button
          key={t.key}
          className={`tab-item${active === t.key ? ' active' : ''}`}
          onClick={() => onChange(t.key)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          {t.icon && <t.icon size={13} />}
          {t.label}
        </button>
      ))}
    </div>
  )
}
