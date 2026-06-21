import Spinner from './Spinner'
import EmptyState from './EmptyState'

/**
 * columns: [{ key, label, render?, className?, style?, width? }]
 * render(row) → ReactNode  (optional; defaults to row[key])
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
}) {
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

  return (
    <div className="card" style={{ padding: 0 }}>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map(col => (
                <th key={col.key} style={col.style} width={col.width}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map(row => (
              <tr
                key={row[rowKey]}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                style={{ cursor: onRowClick ? 'pointer' : undefined, ...rowStyle?.(row) }}
              >
                {columns.map(col => (
                  <td key={col.key} className={col.className}>
                    {col.render ? col.render(row) : row[col.key] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
