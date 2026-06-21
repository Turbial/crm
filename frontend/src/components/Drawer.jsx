import { useEffect } from 'react'
import { X } from 'lucide-react'

/**
 * Slide-in side panel (right by default).
 *
 * <Drawer open={open} onClose={onClose} title="Details" width={400}>
 *   …content…
 * </Drawer>
 */
export default function Drawer({ open, onClose, title, children, width = 420, side = 'right', footer }) {
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    if (open) document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [open, onClose])

  if (!open) return null

  const isRight = side === 'right'

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.25)', zIndex: 199 }}
        onClick={onClose}
      />
      <div
        style={{
          position: 'fixed',
          top: 0, bottom: 0,
          [isRight ? 'right' : 'left']: 0,
          width,
          background: 'var(--surface)',
          borderLeft: isRight ? '1px solid var(--border)' : undefined,
          borderRight: !isRight ? '1px solid var(--border)' : undefined,
          boxShadow: 'var(--shadow-md)',
          zIndex: 200,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{title}</h2>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>{children}</div>
        {footer && (
          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            {footer}
          </div>
        )}
      </div>
    </>
  )
}
