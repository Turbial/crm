export default function StatsGrid({ children, columns }) {
  return (
    <div
      className="stats-grid"
      style={columns ? { gridTemplateColumns: `repeat(${columns}, 1fr)` } : undefined}
    >
      {children}
    </div>
  )
}
