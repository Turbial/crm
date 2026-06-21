/**
 * Two-panel (master-detail) layout.
 * leftWidth  — px or CSS value for the left panel (default 300px)
 * border     — show dividing border (default true)
 *
 * Usage:
 *   <TwoPanel
 *     left={<ThreadList … />}
 *     right={selected ? <ThreadDetail … /> : <EmptyState … />}
 *   />
 */
export default function TwoPanel({ left, right, leftWidth = 300, style }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 0,
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        background: 'var(--surface)',
        overflow: 'hidden',
        minHeight: 480,
        ...style,
      }}
    >
      <div
        style={{
          width: leftWidth,
          flexShrink: 0,
          borderRight: '1px solid var(--border)',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {left}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {right}
      </div>
    </div>
  )
}
