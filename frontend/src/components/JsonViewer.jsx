import CopyButton from './CopyButton'

export default function JsonViewer({ value, maxHeight = 320, copyable = true }) {
  const text = value == null ? 'null' : JSON.stringify(value, null, 2)

  return (
    <div style={{ position: 'relative' }}>
      {copyable && (
        <div style={{ position: 'absolute', top: 6, right: 6, zIndex: 1 }}>
          <CopyButton text={text} size={12} />
        </div>
      )}
      <pre
        style={{
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          padding: '10px 12px',
          fontSize: 12,
          fontFamily: 'monospace',
          overflowX: 'auto',
          overflowY: 'auto',
          margin: 0,
          maxHeight,
          color: 'var(--text)',
          lineHeight: 1.6,
        }}
      >
        {text}
      </pre>
    </div>
  )
}
