import { useState, useEffect } from 'react'
import { Search } from 'lucide-react'

/**
 * Controlled search input with optional built-in debounce.
 *
 * Controlled (caller owns state):
 *   <SearchInput value={search} onChange={setSearch} />
 *
 * With built-in debounce (caller gets debounced value):
 *   <SearchInput onSearch={setDebouncedSearch} delay={300} />
 */
export default function SearchInput({
  value: controlledValue,
  onChange,
  onSearch,
  delay = 300,
  placeholder = 'Search…',
  width = 200,
  autoFocus,
}) {
  const [local, setLocal] = useState(controlledValue ?? '')

  // sync if controlled
  useEffect(() => {
    if (controlledValue !== undefined) setLocal(controlledValue)
  }, [controlledValue])

  useEffect(() => {
    if (!onSearch) return
    const t = setTimeout(() => onSearch(local), delay)
    return () => clearTimeout(t)
  }, [local, delay, onSearch])

  function handleChange(e) {
    setLocal(e.target.value)
    onChange?.(e.target.value)
  }

  return (
    <div style={{ position: 'relative', width }}>
      <Search
        size={14}
        style={{
          position: 'absolute', left: 10, top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--text-muted)', pointerEvents: 'none',
        }}
      />
      <input
        className="form-input"
        value={local}
        onChange={handleChange}
        placeholder={placeholder}
        autoFocus={autoFocus}
        style={{ width: '100%', paddingLeft: 32 }}
      />
    </div>
  )
}
