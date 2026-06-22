import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

export default function CopyButton({ text, size = 13, label }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (label) {
    return (
      <button className="btn btn-secondary btn-sm flex gap-1 items-center" onClick={handleCopy}>
        {copied ? <Check size={size} color="var(--success)" /> : <Copy size={size} />}
        {copied ? 'Copied!' : label}
      </button>
    )
  }

  return (
    <button className="btn btn-ghost btn-icon btn-sm" onClick={handleCopy} title="Copy">
      {copied ? <Check size={size} color="var(--success)" /> : <Copy size={size} />}
    </button>
  )
}
