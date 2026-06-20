import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, Users, Building2, Briefcase, FileText } from 'lucide-react'
import { get } from '../api'

const TYPE_ICONS = {
  lead: Users,
  contact: Users,
  company: Building2,
  deal: Briefcase,
  note: FileText,
}

const TYPE_ROUTES = {
  lead: id => `/crm/leads/${id}`,
  contact: id => `/crm/contacts/${id}`,
  company: id => `/crm/companies/${id}`,
  deal: id => `/crm/deals/${id}`,
}

export default function SearchModal({ open, onClose }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(0)
  const inputRef = useRef(null)
  const navigate = useNavigate()
  const debounceRef = useRef(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setSelected(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const doSearch = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); return }
    setLoading(true)
    try {
      const data = await get('/search', { q, limit: 12 })
      setResults(Array.isArray(data) ? data : data.results || [])
      setSelected(0)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(query), 250)
    return () => clearTimeout(debounceRef.current)
  }, [query, doSearch])

  function navigate_to(result) {
    const route = TYPE_ROUTES[result.entity_type]
    if (route) navigate(route(result.id))
    onClose()
  }

  function handleKey(e) {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
    if (e.key === 'Enter' && results[selected]) navigate_to(results[selected])
  }

  if (!open) return null

  return (
    <div className="modal-overlay" onClick={onClose} style={{ alignItems: 'flex-start', paddingTop: 80 }}>
      <div
        className="modal-box"
        style={{ width: 560, maxWidth: '90vw', padding: 0, overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
          <Search size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Search leads, contacts, deals…"
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontSize: 15, color: 'var(--text)',
            }}
          />
          {query && (
            <button onClick={() => setQuery('')} className="btn btn-ghost btn-icon btn-sm">
              <X size={14} />
            </button>
          )}
          <kbd style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border-subtle)' }}>Esc</kbd>
        </div>

        {loading && (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Searching…
          </div>
        )}

        {!loading && query && results.length === 0 && (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            No results for "{query}"
          </div>
        )}

        {results.length > 0 && (
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {results.map((r, i) => {
              const Icon = TYPE_ICONS[r.entity_type] || FileText
              return (
                <div
                  key={r.id}
                  onClick={() => navigate_to(r)}
                  className="flex gap-3 items-center"
                  style={{
                    padding: '10px 16px',
                    cursor: 'pointer',
                    background: i === selected ? 'var(--accent-soft)' : undefined,
                    borderBottom: '1px solid var(--border-subtle)',
                  }}
                  onMouseEnter={() => setSelected(i)}
                >
                  <Icon size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="font-medium text-sm" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.name || r.title || r.id}
                    </div>
                    {r.subtitle && (
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.subtitle}</div>
                    )}
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize', flexShrink: 0 }}>
                    {r.entity_type}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {!query && (
          <div style={{ padding: '20px 16px' }}>
            <div className="text-xs" style={{ color: 'var(--text-muted)', marginBottom: 8 }}>Quick navigation</div>
            {[
              ['Leads', '/crm/leads'],
              ['Contacts', '/crm/contacts'],
              ['Deals', '/crm/deals'],
              ['Daily Brief', '/daily-brief'],
            ].map(([label, to]) => (
              <div key={to} onClick={() => { navigate(to); onClose() }}
                className="flex items-center gap-2"
                style={{ padding: '7px 0', cursor: 'pointer', fontSize: 14, color: 'var(--text)' }}>
                <Search size={13} style={{ color: 'var(--text-muted)' }} />
                {label}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
