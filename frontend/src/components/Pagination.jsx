/**
 * Offset-based pagination.
 *
 * <Pagination offset={offset} limit={50} total={total} onChange={setOffset} />
 * or when total is unknown:
 * <Pagination offset={offset} limit={50} hasMore={data.length === 50} onChange={setOffset} />
 */
export default function Pagination({ offset, limit, total, hasMore, onChange }) {
  const page = Math.floor(offset / limit) + 1
  const totalPages = total != null ? Math.ceil(total / limit) : null
  const canPrev = offset > 0
  const canNext = total != null ? offset + limit < total : hasMore

  if (!canPrev && !canNext) return null

  return (
    <div className="flex gap-2 items-center" style={{ justifyContent: 'center', paddingTop: 16 }}>
      <button
        className="btn btn-secondary btn-sm"
        disabled={!canPrev}
        onClick={() => onChange(Math.max(0, offset - limit))}
      >
        ← Prev
      </button>
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
        {totalPages ? `Page ${page} of ${totalPages}` : `Page ${page}`}
      </span>
      <button
        className="btn btn-secondary btn-sm"
        disabled={!canNext}
        onClick={() => onChange(offset + limit)}
      >
        Next →
      </button>
    </div>
  )
}
