/**
 * Horizontal row of filter controls.
 * Render children (selects, SearchInput, buttons) and they get consistent spacing.
 *
 * <FilterBar>
 *   <SearchInput onSearch={setQ} />
 *   <select className="form-input" value={status} onChange={…}>…</select>
 *   <button className="btn btn-primary">New</button>
 * </FilterBar>
 */
export default function FilterBar({ children, style }) {
  return (
    <div
      className="flex gap-2 items-center"
      style={{ marginBottom: 16, flexWrap: 'wrap', ...style }}
    >
      {children}
    </div>
  )
}
