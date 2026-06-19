import { Activity } from 'lucide-react'

function fmtDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function Timeline({ events = [] }) {
  if (!events.length) return <p className="text-muted">No activity yet.</p>

  return (
    <div className="timeline">
      {events.map((ev, i) => (
        <div key={ev.id || i} className="timeline-item">
          <div className="timeline-dot-col">
            <div className="timeline-dot"><Activity size={12} color="#2563eb" /></div>
            {i < events.length - 1 && <div className="timeline-line" />}
          </div>
          <div className="timeline-body">
            <div className="timeline-title">{ev.summary || ev.event_type}</div>
            <div className="timeline-meta">
              {ev.actor_name && <span>{ev.actor_name}</span>}
              <span>{fmtDate(ev.occurred_at || ev.created_at)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
