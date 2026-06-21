const COLORS = [
  '#2563eb', '#7c3aed', '#db2777', '#dc2626',
  '#d97706', '#16a34a', '#0891b2', '#475569',
]

function colorFor(name = '') {
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return COLORS[Math.abs(h) % COLORS.length]
}

/**
 * <Avatar name="Jane Doe" size={30} />
 * <Avatar src={user.avatar_url} name="Jane" size={36} />
 */
export default function Avatar({ name = '', src, size = 30, style }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() || '')
    .join('')

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, ...style }}
      />
    )
  }

  return (
    <div
      style={{
        width: size, height: size, borderRadius: '50%',
        background: colorFor(name),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: Math.round(size * 0.38), fontWeight: 700,
        color: '#fff', flexShrink: 0, ...style,
      }}
    >
      {initials || '?'}
    </div>
  )
}
