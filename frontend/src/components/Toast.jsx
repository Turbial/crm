import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react'

const ICONS = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertCircle,
}

const COLORS = {
  success: { bg: 'var(--success-soft)', border: '#86efac', text: 'var(--success)' },
  error:   { bg: 'var(--danger-soft)',  border: '#fca5a5', text: 'var(--danger)' },
  warning: { bg: 'var(--warning-soft)', border: '#fcd34d', text: 'var(--warning)' },
}

/**
 * Inline toast/alert banner (not a global portal).
 * Auto-dismisses after `duration` ms (0 = stay forever).
 *
 * <Toast message="Saved!" type="success" onClose={() => setMsg(null)} />
 *
 * useToast() helper:
 *   const [toast, showToast] = useToast()
 *   showToast('Saved!', 'success')
 *   return <Toast {...toast} />
 */
export default function Toast({ message, type = 'success', onClose, duration = 4000 }) {
  useEffect(() => {
    if (!message || !duration) return
    const t = setTimeout(onClose, duration)
    return () => clearTimeout(t)
  }, [message, duration, onClose])

  if (!message) return null

  const c = COLORS[type] || COLORS.success
  const Icon = ICONS[type] || CheckCircle

  return (
    <div
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        background: c.bg, border: `1px solid ${c.border}`,
        borderRadius: 8, padding: '10px 14px', fontSize: 13.5,
        color: c.text, fontWeight: 500,
      }}
    >
      <Icon size={16} style={{ flexShrink: 0, marginTop: 1 }} />
      <span style={{ flex: 1 }}>{message}</span>
      {onClose && (
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: c.text, opacity: .6 }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}

export function useToast() {
  const [state, setState] = useState({ message: null, type: 'success' })
  function show(message, type = 'success') { setState({ message, type }) }
  function hide() { setState(s => ({ ...s, message: null })) }
  return [{ ...state, onClose: hide }, show]
}
