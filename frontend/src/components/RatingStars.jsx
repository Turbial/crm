/**
 * Display-only:  <RatingStars value={4} max={5} />
 * Interactive:   <RatingStars value={rating} onChange={setRating} max={5} />
 */
export default function RatingStars({ value = 0, max = 5, onChange, size = 16 }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      {Array.from({ length: max }, (_, i) => i + 1).map(n => (
        <span
          key={n}
          onClick={onChange ? () => onChange(n) : undefined}
          style={{
            fontSize: size,
            color: n <= value ? 'var(--warning)' : 'var(--border)',
            cursor: onChange ? 'pointer' : 'default',
            lineHeight: 1,
            transition: 'color .1s',
          }}
        >
          ★
        </span>
      ))}
    </span>
  )
}
