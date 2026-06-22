import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Key, FileSignature } from 'lucide-react'
import { get, post } from '../api'
import Spinner from '../components/Spinner'
import Badge from '../components/Badge'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'

const fmtDate = d => d ? new Date(d).toLocaleString() : '—'

const emptyTokenForm = { lead_id: '', contact_id: '', expires_at: '' }
const emptyEsigForm = { lead_id: '', title: '', signer_email: '', document_url: '' }

export default function CustomerPortal() {
  const qc = useQueryClient()
  const [tab, setTab] = useState('tokens')

  const [showTokenModal, setShowTokenModal] = useState(false)
  const [tokenForm, setTokenForm] = useState(emptyTokenForm)
  const [createdToken, setCreatedToken] = useState(null)

  const [showEsigModal, setShowEsigModal] = useState(false)
  const [esigForm, setEsigForm] = useState(emptyEsigForm)

  const { data: tokens = [], isLoading: tokensLoading } = useQuery({
    queryKey: ['portal-tokens'],
    queryFn: () => get('/portal/tokens'),
  })

  const { data: esignatures = [], isLoading: esigLoading } = useQuery({
    queryKey: ['portal-esignatures'],
    queryFn: () => get('/portal/esignature').then(r => Array.isArray(r) ? r : []),
    retry: false,
  })

  const generateToken = useMutation({
    mutationFn: body => post('/portal/tokens', body),
    onSuccess: data => {
      qc.invalidateQueries({ queryKey: ['portal-tokens'] })
      setShowTokenModal(false)
      setTokenForm(emptyTokenForm)
      setCreatedToken(data)
    },
  })

  const createEsig = useMutation({
    mutationFn: body => post('/portal/esignature', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portal-esignatures'] })
      setShowEsigModal(false)
      setEsigForm(emptyEsigForm)
    },
  })

  function submitToken() {
    const body = {
      lead_id: tokenForm.lead_id || undefined,
      contact_id: tokenForm.contact_id || undefined,
      expires_at: tokenForm.expires_at || undefined,
    }
    generateToken.mutate(body)
  }

  function submitEsig() {
    createEsig.mutate(esigForm)
  }

  const isLoading = tab === 'tokens' ? tokensLoading : esigLoading

  return (
    <div>
      <div className="page-header">
        <div><h1>Customer Portal</h1></div>
        {tab === 'tokens' && (
          <button className="btn btn-primary" onClick={() => setShowTokenModal(true)}>
            <Key size={15} /> Generate Token
          </button>
        )}
        {tab === 'esig' && (
          <button className="btn btn-primary" onClick={() => setShowEsigModal(true)}>
            <FileSignature size={15} /> New E-Signature Request
          </button>
        )}
      </div>

      <div className="flex gap-2" style={{ marginBottom: 20 }}>
        <button
          className={tab === 'tokens' ? 'btn btn-primary' : 'btn btn-secondary btn-sm'}
          onClick={() => setTab('tokens')}
        >
          Access Tokens
        </button>
        <button
          className={tab === 'esig' ? 'btn btn-primary' : 'btn btn-secondary btn-sm'}
          onClick={() => setTab('esig')}
        >
          E-Signatures
        </button>
      </div>

      {isLoading && <Spinner />}

      {!isLoading && tab === 'tokens' && (
        tokens.length === 0
          ? <EmptyState icon={Key} title="No access tokens" description="Generate a portal access token to share with a lead or contact." />
          : (
            <div className="card" style={{ padding: 0 }}>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Lead</th>
                      <th>Contact</th>
                      <th>Token</th>
                      <th>Expires</th>
                      <th>Used At</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tokens.map(t => (
                      <tr key={t.id}>
                        <td className="td-muted text-sm">{t.lead_id ? t.lead_id.slice(0, 8) : '—'}</td>
                        <td className="td-muted text-sm">{t.contact_id ? t.contact_id.slice(0, 8) : '—'}</td>
                        <td>
                          <code style={{ background: 'var(--bg)', borderRadius: 4, padding: '2px 6px', fontSize: 12 }}>
                            {t.token ? t.token.slice(0, 12) + '…' : '—'}
                          </code>
                        </td>
                        <td className="td-muted text-sm">{fmtDate(t.expires_at)}</td>
                        <td>
                          {t.used_at
                            ? <span className="text-sm">{fmtDate(t.used_at)}</span>
                            : <Badge label="Unused" color="gray" />}
                        </td>
                        <td className="td-muted text-sm">{fmtDate(t.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
      )}

      {!isLoading && tab === 'esig' && (
        esignatures.length === 0
          ? <EmptyState icon={FileSignature} title="No e-signature requests" description="Create an e-signature request to collect a signed document from a lead." />
          : (
            <div className="card" style={{ padding: 0 }}>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Lead</th>
                      <th>Signer Email</th>
                      <th>Status</th>
                      <th>Signed At</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {esignatures.map(e => (
                      <tr key={e.id}>
                        <td className="font-medium">{e.title || '—'}</td>
                        <td className="td-muted text-sm">{e.lead_id ? e.lead_id.slice(0, 8) : '—'}</td>
                        <td className="text-sm">{e.signer_email || '—'}</td>
                        <td><Badge label={e.status || 'pending'} /></td>
                        <td className="td-muted text-sm">{fmtDate(e.signed_at)}</td>
                        <td className="td-muted text-sm">{fmtDate(e.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
      )}

      <Modal
        open={showTokenModal}
        onClose={() => { setShowTokenModal(false); setTokenForm(emptyTokenForm) }}
        title="Generate Access Token"
        footer={
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => { setShowTokenModal(false); setTokenForm(emptyTokenForm) }}>Cancel</button>
            <button className="btn btn-primary" disabled={generateToken.isPending} onClick={submitToken}>
              {generateToken.isPending ? 'Generating…' : 'Generate'}
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Lead ID</label>
          <input
            className="form-input"
            placeholder="lead_…"
            value={tokenForm.lead_id}
            onChange={e => setTokenForm(f => ({ ...f, lead_id: e.target.value }))}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Contact ID</label>
          <input
            className="form-input"
            placeholder="contact_…"
            value={tokenForm.contact_id}
            onChange={e => setTokenForm(f => ({ ...f, contact_id: e.target.value }))}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Expires At</label>
          <input
            className="form-input"
            type="date"
            value={tokenForm.expires_at}
            onChange={e => setTokenForm(f => ({ ...f, expires_at: e.target.value }))}
          />
        </div>
        {generateToken.isError && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{generateToken.error.message}</p>}
      </Modal>

      <Modal
        open={!!createdToken}
        onClose={() => setCreatedToken(null)}
        title="Token Generated"
        footer={
          <button className="btn btn-secondary btn-sm" onClick={() => setCreatedToken(null)}>Close</button>
        }
      >
        {createdToken && (
          <div>
            <div className="form-group">
              <label className="form-label">Token</label>
              <div className="flex gap-2 items-center">
                <input
                  className="form-input"
                  readOnly
                  value={createdToken.token || ''}
                  style={{ fontFamily: 'monospace', fontSize: 13 }}
                />
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => navigator.clipboard.writeText(createdToken.token || '')}
                >
                  Copy
                </button>
              </div>
            </div>
            {createdToken.url && (
              <div className="form-group">
                <label className="form-label">Portal URL</label>
                <div className="flex gap-2 items-center">
                  <input
                    className="form-input"
                    readOnly
                    value={createdToken.url}
                    style={{ fontSize: 13 }}
                  />
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => navigator.clipboard.writeText(createdToken.url)}
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={showEsigModal}
        onClose={() => { setShowEsigModal(false); setEsigForm(emptyEsigForm) }}
        title="New E-Signature Request"
        footer={
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => { setShowEsigModal(false); setEsigForm(emptyEsigForm) }}>Cancel</button>
            <button
              className="btn btn-primary"
              disabled={createEsig.isPending || !esigForm.lead_id || !esigForm.title || !esigForm.signer_email}
              onClick={submitEsig}
            >
              {createEsig.isPending ? 'Sending…' : 'Send Request'}
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Lead ID *</label>
          <input
            className="form-input"
            placeholder="lead_…"
            value={esigForm.lead_id}
            onChange={e => setEsigForm(f => ({ ...f, lead_id: e.target.value }))}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Title *</label>
          <input
            className="form-input"
            placeholder="e.g. Service Agreement"
            value={esigForm.title}
            onChange={e => setEsigForm(f => ({ ...f, title: e.target.value }))}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Signer Email *</label>
          <input
            className="form-input"
            type="email"
            placeholder="signer@example.com"
            value={esigForm.signer_email}
            onChange={e => setEsigForm(f => ({ ...f, signer_email: e.target.value }))}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Document URL</label>
          <input
            className="form-input"
            placeholder="https://…"
            value={esigForm.document_url}
            onChange={e => setEsigForm(f => ({ ...f, document_url: e.target.value }))}
          />
        </div>
        {createEsig.isError && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{createEsig.error.message}</p>}
      </Modal>
    </div>
  )
}
