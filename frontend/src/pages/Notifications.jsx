import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, Check } from 'lucide-react'
import { get, post } from '../api'
import Spinner from '../components/Spinner'
import EmptyState from '../components/EmptyState'

export default function Notifications() {
  const qc = useQueryClient()

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => get('/notifications', { limit: 100 }),
  })

  const markRead = useMutation({
    mutationFn: id => post(`/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const markAll = useMutation({
    mutationFn: () => post('/notifications/read-all'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  if (isLoading) return <Spinner />

  const unread = notifications.filter(n => !n.read)

  return (
    <div>
      <div className="page-header">
        <div><h1>Notifications</h1><p>{unread.length} unread</p></div>
        {unread.length > 0 && (
          <button className="btn btn-secondary" onClick={() => markAll.mutate()} disabled={markAll.isPending}>
            <Check size={14} /> Mark all read
          </button>
        )}
      </div>

      {notifications.length === 0
        ? <EmptyState icon={Bell} title="No notifications" description="Notifications appear here when actions, approvals, and SLA events occur." />
        : (
          <div className="card" style={{ padding: 0 }}>
            {notifications.map(n => (
              <div key={n.id} className="flex gap-3 items-start" style={{
                padding: '14px 18px',
                borderBottom: '1px solid var(--border-subtle)',
                background: n.read ? undefined : 'var(--accent-soft)',
              }}>
                <Bell size={16} color={n.read ? 'var(--text-muted)' : 'var(--accent)'} style={{ marginTop: 3, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="font-medium text-sm">{n.title}</div>
                  {n.body && <div className="text-sm" style={{ color: 'var(--text-muted)', marginTop: 2 }}>{n.body}</div>}
                  <div className="text-xs" style={{ color: 'var(--text-xs)', marginTop: 4 }}>{new Date(n.created_at).toLocaleString()}</div>
                </div>
                {!n.read && (
                  <button className="btn btn-ghost btn-sm btn-icon" onClick={() => markRead.mutate(n.id)}>
                    <Check size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
    </div>
  )
}
