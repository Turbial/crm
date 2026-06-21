/**
 * A card with an optional titled header and action slot.
 *
 * <SectionCard title="Budget" icon={DollarSign} action={<button …>Edit</button>}>
 *   …content…
 * </SectionCard>
 */
export default function SectionCard({ title, icon: Icon, action, children, style, bodyStyle, noPad }) {
  return (
    <div className="card" style={{ padding: noPad ? 0 : undefined, ...style }}>
      {(title || action) && (
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: noPad ? '14px 20px' : undefined,
            borderBottom: noPad ? '1px solid var(--border)' : undefined,
            marginBottom: noPad ? 0 : 16,
          }}
        >
          <div className="flex gap-2 items-center">
            {Icon && <Icon size={16} style={{ color: 'var(--text-muted)' }} />}
            {title && <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{title}</h2>}
          </div>
          {action}
        </div>
      )}
      <div style={bodyStyle}>{children}</div>
    </div>
  )
}
