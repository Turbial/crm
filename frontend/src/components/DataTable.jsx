import { useState } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import Spinner from './Spinner'
import EmptyState from './EmptyState'

/**
 * columns: [{
 *   key, label,
 *   render?(row) → ReactNode,
 *   sortable?: boolean,
 *   sortFn?(a, b) → number,   // custom comparator
 *   className?, style?, width?
 * }]
 *
 * selectable: true → checkbox column; selectedIds + onSelectionChange for controlled mode
 * bulkBar: ReactNode rendered above table when rows are selected
 */
export default function DataTable({
  columns,
  data = [],
  isLoading,
  emptyIcon,
  emptyTitle = 'No data',
  emptyDescription,
  emptyAction,
  onRowClick,
  rowKey = 'id',
  rowStyle,
  // sorting
  defaultSortKey,
  defaultSortDir = 'asc',
  // selection
  selectable = false,
  selectedIds,
  onSelectionChange,
  bulkBar,
}) {
  const [sortKey, setSortKey] = useState(defaultSortKey || null)
  const [sortDir, setSortDir] = useState(defaultSortDir)
  const [internalSelected, setInternalSelected] = useState(new Set())

  const controlled = selectedIds !== undefined
  const selected = controlled ? new Set(selectedIds) : internalSelected
  const setSelected = controlled
    ? ids => onSelectionChange?.([...ids])
    : ids => setInternalSelected(ids)

  if (isLoading) return <Spinner />
  if (!data.length) {
    return (
      <EmptyState
        icon={emptyIcon}
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    )
  }

  // ── Sort ──────────────────────────────────────────────────────────────────
  const col = columns.find(c => c.key === sortKey)
  const sorted = sortKey && col
    ? [...data].sort((a, b) => {
        const result = col.sortFn
          ? col.sortFn(a, b)
          : String(a[sortKey] ?? '').localeCompare(String(b[sortKey] ?? ''), undefined, { numeric: true })
        return sortDir === 'asc' ? result : -result
      })
    : data

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  // ── Selection ─────────────────────────────────────────────────────────────
  const allIds = sorted.map(r => r[rowKey])
  const allChecked = allIds.length > 0 && allIds.every(id => selected.has(id))
  const someChecked = !allChecked && allIds.some(id => selected.has(id))

  function toggleAll() {
    if (allChecked) setSelected(new Set())
    else setSelected(new Set(allIds))
  }

  function toggleRow(id) {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
  }

  // ── Sort icon ─────────────────────────────────────────────────────────────
  function SortIcon({ colKey }) {
    if (sortKey !== colKey) return <ChevronsUpDown size={12} style={{ opacity: 0.35, marginLeft: 4 }} />
    return sortDir === 'asc'
      ? <ChevronUp size={12} style={{ marginLeft: 4, color: 'var(--accent)' }} />
      : <ChevronDown size={12} style={{ marginLeft: 4, color: 'var(--accent)' }} />
  }

  return (
    <div className="card" style={{ padding: 0 }}>
      {selectable && selected.size > 0 && bulkBar && (
        <div style={{
          padding: '10px 16px', background: 'var(--accent-soft)',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 12, fontSize: 13,
        }}>
          <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{selected.size} selected</span>
          {bulkBar}
          <button
            className="btn btn-ghost btn-sm"
            style={{ marginLeft: 'auto' }}
            onClick={() => setSelected(new Set())}
          >
            Clear
          </button>
        </div>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {selectable && (
                <th style={{ width: 40, paddingRight: 0 }}>
                  <input
                    type="checkbox"
                    checked={allChecked}
                    ref={el => { if (el) el.indeterminate = someChecked }}
                    onChange={toggleAll}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
              )}
              {columns.map(col => (
                <th
                  key={col.key}
                  style={{
                    ...col.style,
                    cursor: col.sortable ? 'pointer' : undefined,
                    userSelect: col.sortable ? 'none' : undefined,
                    whiteSpace: 'nowrap',
                  }}
                  width={col.width}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                    {col.label}
                    {col.sortable && <SortIcon colKey={col.key} />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(row => {
              const id = row[rowKey]
              const isSelected = selected.has(id)
              return (
                <tr
                  key={id}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  style={{
                    cursor: onRowClick ? 'pointer' : undefined,
                    background: isSelected ? 'var(--accent-soft)' : undefined,
                    ...rowStyle?.(row),
                  }}
                >
                  {selectable && (
                    <td style={{ width: 40, paddingRight: 0 }} onClick={e => { e.stopPropagation(); toggleRow(id) }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRow(id)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                  )}
                  {columns.map(col => (
                    <td key={col.key} className={col.className}>
                      {col.render ? col.render(row) : row[col.key] ?? '—'}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
