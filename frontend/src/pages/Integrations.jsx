import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plug } from 'lucide-react'
import { get, post, del } from '../api'
import Spinner from '../components/Spinner'
import Badge from '../components/Badge'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'

const PROVIDERS = [
  { key: 'stripe', label: 'Stripe', color: '#635bff' },
  { key: 'twilio', label: 'Twilio', color: '#f22f46' },
  { key: 'sendgrid', label: 'SendGrid', color: '#1a82e2' },
  { key: 'google_calendar', label: 'Google Calendar', color: '#4285f4' },
  { key: 'slack', label: 'Slack', color: '#4a154b' },
  { key: 'hubspot', label: 'HubSpot', color: '#ff7a59' },
  { key: 'salesforce', label: 'Salesforce', color: '#00a1e0' },
  { key: 'zapier', label: 'Zapier', color: '#ff4a00' },
]

export default function Integrations() {
  const qc = useQueryClient()
  const [connectProvider, setConnectProvider] = useState(null)
  const [configJson, setConfigJson] = useState('{}')
  const [jsonError, setJsonError] = useState('')

  const { data: integrations = [], isLoading } = useQuery({
    queryKey: ['integrations'],
    queryFn: () => get('/integrations', { limit: 100 }),
  })

  const connectMut = useMutation({
    mutationFn: body => post('/integrations', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['integrations'] })
      setConnectProvider(null)
      setConfigJson('{}')
      setJsonError('')
    },
  })

  const disconnectMut = useMutation({
    mutationFn: id => del(`/integrations/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['integrations'] }),
  })

  function getConnected(providerKey) {
    return integrations.find(i => i.provider === providerKey)
  }

  function openConnect(p) {
    setConnectProvider(p)
    setConfigJson('{}')
    setJsonError('')
  }

  function submitConnect() {
    let config
    try {
      config = JSON.parse(configJson)
      setJsonError('')
    } catch {
      setJsonError('Invalid JSON')
      return
    }
    connectMut.mutate({ provider: connectProvider.key, config })
  }

  const connectedCount = integrations.length

  if (isLoading) return <Spinner />

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Integrations</h1>
          <p>{connectedCount} connected</p>
        </div>
      </div>

      {connectedCount === 0 && (
        <EmptyState
          icon={Plug}
          title="No integrations connected"
          description="Connect your tools to automate workflows and sync data."
        />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16, marginTop: connectedCount === 0 ? 0 : 8 }}>
        {PROVIDERS.map(p => {
          const connected = getConnected(p.key)
          return (
            <div key={p.key} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="flex gap-2 items-center">
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: p.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 16,
                  flexShrink: 0,
                }}>
                  {p.label[0]}
                </div>
                <div>
                  <div className="font-medium">{p.label}</div>
                  {connected && (
                    <div className="text-xs td-muted" style={{ marginTop: 2 }}>
                      Since {new Date(connected.created_at).toLocaleDateString()}
                    </div>
                  )}
                </div>
                <div style={{ marginLeft: 'auto' }}>
                  <Badge label={connected ? 'connected' : 'not_connected'} color={connected ? 'green' : 'gray'} />
                </div>
              </div>
              <div>
                {connected
                  ? (
                    <button
                      className="btn btn-danger btn-sm"
                      disabled={disconnectMut.isPending}
                      onClick={() => disconnectMut.mutate(connected.id)}
                    >
                      Disconnect
                    </button>
                  )
                  : (
                    <button className="btn btn-secondary btn-sm" onClick={() => openConnect(p)}>
                      Connect
                    </button>
                  )}
              </div>
            </div>
          )
        })}
      </div>

      <Modal
        open={!!connectProvider}
        onClose={() => { setConnectProvider(null); setConfigJson('{}'); setJsonError('') }}
        title={`Connect ${connectProvider?.label || ''}`}
        footer={
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => { setConnectProvider(null); setConfigJson('{}'); setJsonError('') }}>
              Cancel
            </button>
            <button className="btn btn-primary" disabled={connectMut.isPending} onClick={submitConnect}>
              {connectMut.isPending ? 'Connecting…' : 'Connect'}
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Provider</label>
          <input className="form-input" value={connectProvider?.key || ''} disabled />
        </div>
        <div className="form-group">
          <label className="form-label">Config (JSON)</label>
          <textarea
            className="form-input"
            rows={6}
            value={configJson}
            onChange={e => { setConfigJson(e.target.value); setJsonError('') }}
            style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: 13 }}
            placeholder='{"api_key": "..."}'
          />
          {jsonError && <p style={{ color: 'var(--danger)', fontSize: 12, marginTop: 4 }}>{jsonError}</p>}
        </div>
        {connectMut.isError && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{connectMut.error.message}</p>}
      </Modal>
    </div>
  )
}
