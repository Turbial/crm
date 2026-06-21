import { useState, useRef, useEffect } from 'react'

/**
 * Click-to-edit text field. Shows value as text, switches to input on click.
 *
 * <InlineEdit value={name} onSave={v => patch('/entity/id', { name: v })} />
 */
export default function InlineEdit({ value, onSave, placeholder = 'Click to edit', multiline, style }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const ref = useRef()

  useEffect(() => { setDraft(value ?? '') }, [value])
  useEffect(() => { if (editing) ref.current?.focus() }, [editing])

  function commit() {
    setEditing(false)
    if (draft !== value) onSave?.(draft)
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !multiline) commit()
    if (e.key === 'Escape') { setEditing(false); setDraft(value ?? '') }
  }

  if (!editing) {
    return (
      <span
        onClick={() => setEditing(true)}
        style={{
          cursor: 'text',
          borderRadius: 4,
          padding: '2px 4px',
          display: 'inline-block',
          minWidth: 40,
          color: draft ? 'var(--text)' : 'var(--text-muted)',
          transition: 'background .1s',
          ...style,
        }}
        title="Click to edit"
      >
        {draft || placeholder}
      </span>
    )
  }

  const props = {
    ref,
    value: draft,
    onChange: e => setDraft(e.target.value),
    onBlur: commit,
    onKeyDown: handleKey,
    className: 'form-input',
    style: { width: '100%', ...style },
  }

  return multiline ? <textarea rows={3} {...props} /> : <input {...props} />
}
