const MAP = {
  // status
  new: 'blue', contacted: 'yellow', qualified: 'green', proposal: 'purple',
  negotiation: 'yellow', won: 'green', lost: 'red',
  // task/action
  completed: 'green', failed: 'red', pending: 'blue', running: 'yellow',
  cancelled: 'gray', retrying: 'yellow', waiting_approval: 'purple',
  // misc
  open: 'blue', resolved: 'green', snoozed: 'gray', spam: 'red',
  generated: 'blue', delivered: 'green',
  approved: 'green', rejected: 'red', expired: 'gray',
  active: 'green', inactive: 'gray',
  low: 'gray', medium: 'blue', high: 'yellow', critical: 'red',
}

export default function Badge({ label, color }) {
  const cls = color || MAP[label] || 'gray'
  return <span className={`badge badge-${cls}`}>{label}</span>
}
