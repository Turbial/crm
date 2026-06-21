export default function StatCard({ label, value, color, trend }) {
  return (
    <div className="card stat-card">
      <span className="stat-label">{label}</span>
      <span className="stat-value" style={color ? { color } : undefined}>{value ?? '—'}</span>
      {trend != null && (
        <span style={{ fontSize: 11, color: trend >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 500 }}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
        </span>
      )}
    </div>
  )
}
