import { useState, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity } from 'lucide-react'
import { get } from '../api'
import Spinner from '../components/Spinner'
import Badge from '../components/Badge'
import EmptyState from '../components/EmptyState'

const ENTITY_TYPES = ['lead', 'contact', 'company', 'deal', 'project', 'task']
const ACTOR_TYPES = ['all', 'human', 'agent', 'system']

const actorColor = {
  human: 'var(--accent)',
  agent: '#9b59b6',
  system: 'var(--text-muted)',
}

function relativeTime(d) {
  if (!d) return '—'
  const diff = Date.now() - new Date(d).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const day = Math.floor(h / 24)
  return `${day}d ago`
}

const LIMIT = 50

export default function ActivityFeed() {
  const qc = useQueryClient()
  const [entityTypes, setEntityTypes] = useState([])
  const [actorType, setActorType] = useState('all')
  const [offset, setOffset] = useState(0)
  const [allItems, setAllItems] = useState([])
  const seenIds = useRef(new Set())

  function buildParams(off) {
    return {
      limit: LIMIT,
      offset: off,
      ...(entityTypes.length ? { entity_types: entityTypes.join(',') } : {}),
      ...(actorType !== 'all' ? { actor_type: actorType } : {}),
    }
  }

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['activity-feed', entityTypes, actorType, offset],
    queryFn: () => get('/timeline/feed/org', buildParams(offset)),
    refetchInterval: 30000,
  })

  useEffect(() => {
    if (!data) return
    if (offset === 0) {
      seenIds.current = new Set()
      const fresh = data.filter(item => {
        if (seenIds.current.has(item.id)) return false
        seenIds.current.add(item.id)
        return true
      })
      setAllItems(fresh)
    } else {
      const fresh = data.filter(item => {
        if (seenIds.current.has(item.id)) return false
        seenIds.current.add(item.id)
        return true
      })
      setAllItems(prev => [...prev, ...fresh])
    }
  }, [data, offset])

  function resetAndRefetch() {
    seenIds.current = new Set()
    setAllItems([])
    setOffset(0)
  }

  useEffect(() => {
    resetAndRefetch()
  }, [entityTypes, actorType])

  function toggleEntityType(et) {
    setEntityTypes(prev =>
      prev.includes(et) ? prev.filter(x => x !== et) : [...prev, et]
    )
  }

  const hasMore = data && data.length === LIMIT

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Activity Feed</h1>
          <p>Real-time org activity</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="flex gap-2 items-center" style={{ flexWrap: 'wrap' }}>
          <span className="text-sm td-muted" style={{ marginRight: 4 }}>Entity type:</span>
          {ENTITY_TYPES.map(et => (
            <button
              key={et}
              className={entityTypes.includes(et) ? 'btn btn-primary' : 'btn btn-secondary btn-sm'}
              style={{ fontSize: 12, padding: '3px 10px' }}
              onClick={() => toggleEntityType(et)}
            >
              {et}
            </button>
          ))}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="text-sm td-muted">Actor:</span>
            <select
              className="form-input"
              style={{ width: 130 }}
              value={actorType}
              onChange={e => setActorType(e.target.value)}
            >
              {ACTOR_TYPES.map(t => (
                <option key={t} value={t}>{t === 'all' ? 'All actors' : t}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {isLoading && offset === 0
        ? <Spinner />
        : allItems.length === 0
          ? (
            <EmptyState
              icon={Activity}
              title="No activity yet"
              description="Activity will appear here as your team and agents work."
            />
          )
          : (
            <div style={{ position: 'relative', paddingLeft: 50 }}>
              <div style={{
                position: 'absolute',
                left: 15,
                top: 8,
                bottom: 8,
                width: 2,
                background: 'var(--border)',
                borderRadius: 2,
              }} />

              {allItems.map(item => (
                <div key={item.id} style={{ position: 'relative', marginBottom: 20 }}>
                  <div style={{
                    position: 'absolute',
                    left: -42,
                    top: 4,
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: actorColor[item.actor_type] || 'var(--text-muted)',
                    border: '2px solid var(--bg)',
                    zIndex: 1,
                  }} />

                  <div className="card" style={{ padding: '10px 14px' }}>
                    <div className="flex gap-2 items-center" style={{ marginBottom: 4, flexWrap: 'wrap' }}>
                      <span className="font-medium text-sm">{item.actor_name || item.actor_type}</span>
                      <Badge label={item.event_type} color="blue" />
                      <span
                        style={{
                          fontSize: 11,
                          padding: '1px 7px',
                          borderRadius: 10,
                          background: 'var(--bg-muted)',
                          color: 'var(--text-muted)',
                          fontFamily: 'monospace',
                        }}
                      >
                        {item.entity_type}/{String(item.entity_id).slice(0, 8)}
                      </span>
                      <span className="td-muted text-xs" style={{ marginLeft: 'auto' }}>
                        {relativeTime(item.occurred_at)}
                      </span>
                    </div>
                    {item.summary && (
                      <p className="text-sm td-muted" style={{ margin: 0 }}>{item.summary}</p>
                    )}
                  </div>
                </div>
              ))}

              {hasMore && (
                <div style={{ paddingLeft: 0, marginTop: 8, marginBottom: 8 }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={isFetching}
                    onClick={() => setOffset(prev => prev + LIMIT)}
                  >
                    {isFetching ? 'Loading…' : 'Load more'}
                  </button>
                </div>
              )}
            </div>
          )}
    </div>
  )
}
