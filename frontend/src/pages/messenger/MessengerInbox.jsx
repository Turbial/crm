import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { MessageSquare, Plus } from 'lucide-react'
import { get } from '../../api'
import Spinner from '../../components/Spinner'
import Badge from '../../components/Badge'
import EmptyState from '../../components/EmptyState'

export default function MessengerInbox() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState('open')

  const { data: convos = [], isLoading } = useQuery({
    queryKey: ['conversations', filter],
    queryFn: () => get('/conversations', { status: filter, limit: 50 }),
  })

  if (isLoading) return <Spinner />

  return (
    <div>
      <div className="page-header">
        <div><h1>Messenger</h1><p>Omnichannel conversation inbox</p></div>
        <select className="form-input" value={filter} onChange={e => setFilter(e.target.value)} style={{ width: 150 }}>
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
          <option value="snoozed">Snoozed</option>
        </select>
      </div>

      {convos.length === 0
        ? <EmptyState icon={MessageSquare} title="No conversations" description="Conversations are created when contacts reach out via any channel." />
        : (
          <div className="card" style={{ padding: 0 }}>
            {convos.map(c => (
              <div key={c.id} className="convo-item" onClick={() => navigate(`/messenger/${c.id}`)} style={{ cursor: 'pointer' }}>
                <MessageSquare size={20} color="var(--text-muted)" style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm truncate">{c.subject || `#${c.id.slice(0, 8)}`}</span>
                    <Badge label={c.channel} color="purple" />
                    <Badge label={c.status} />
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {c.updated_at ? new Date(c.updated_at).toLocaleDateString() : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  )
}
