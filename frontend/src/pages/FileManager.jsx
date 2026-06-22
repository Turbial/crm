import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Folder, Link } from 'lucide-react'
import { get, post, del } from '../api'
import Spinner from '../components/Spinner'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'

const fmtDate = d => d ? new Date(d).toLocaleString() : '—'

function fmtSize(bytes) {
  if (bytes == null) return '—'
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  return (bytes / 1024).toFixed(1) + ' KB'
}

function fileIcon(contentType) {
  if (!contentType) return '📎'
  if (contentType.includes('pdf')) return '📄'
  if (contentType.startsWith('image/')) return '🖼️'
  if (contentType.includes('spreadsheet') || contentType.includes('excel') || contentType.includes('csv')) return '📊'
  return '📎'
}

const ENTITY_TYPES = ['lead', 'contact', 'company', 'deal', 'project', 'task']
const emptyLinkForm = { entity_type: 'lead', entity_id: '', filename: '', url: '', content_type: '', file_size: '' }

export default function FileManager() {
  const qc = useQueryClient()
  const [entityType, setEntityType] = useState('')
  const [entityId, setEntityId] = useState('')
  const [debouncedEntityId, setDebouncedEntityId] = useState('')
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [linkForm, setLinkForm] = useState(emptyLinkForm)
  const timerRef = useRef(null)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setDebouncedEntityId(entityId), 500)
    return () => clearTimeout(timerRef.current)
  }, [entityId])

  const { data: files = [], isLoading } = useQuery({
    queryKey: ['attachments', entityType, debouncedEntityId],
    queryFn: () => get('/attachments', {
      limit: 100,
      entity_type: entityType || undefined,
      entity_id: debouncedEntityId || undefined,
    }),
  })

  const linkMut = useMutation({
    mutationFn: body => post('/attachments', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attachments'] })
      setShowLinkModal(false)
      setLinkForm(emptyLinkForm)
    },
  })

  const deleteMut = useMutation({
    mutationFn: id => del(`/attachments/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attachments'] }),
  })

  function submitLink() {
    linkMut.mutate({
      entity_type: linkForm.entity_type,
      entity_id: linkForm.entity_id,
      filename: linkForm.filename,
      url: linkForm.url,
      content_type: linkForm.content_type || undefined,
      file_size: linkForm.file_size ? Number(linkForm.file_size) : undefined,
    })
  }

  function handleDelete(e, file) {
    e.stopPropagation()
    if (window.confirm(`Delete "${file.filename}"?`)) {
      deleteMut.mutate(file.id)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div><h1>File Manager</h1></div>
        <button className="btn btn-primary" onClick={() => setShowLinkModal(true)}>
          <Link size={15} /> Link File
        </button>
      </div>

      <div className="flex gap-2 items-center" style={{ marginBottom: 20 }}>
        <select
          className="form-input"
          style={{ width: 160 }}
          value={entityType}
          onChange={e => setEntityType(e.target.value)}
        >
          <option value="">All types</option>
          {ENTITY_TYPES.map(t => (
            <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
          ))}
        </select>
        <input
          className="form-input"
          style={{ width: 240 }}
          placeholder="Entity ID…"
          value={entityId}
          onChange={e => setEntityId(e.target.value)}
        />
      </div>

      {isLoading && <Spinner />}

      {!isLoading && files.length === 0 && (
        <EmptyState icon={Folder} title="No files found" description="Link a file to an entity or adjust your filters." />
      )}

      {!isLoading && files.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
          {files.map(file => (
            <div
              key={file.id}
              className="card"
              style={{ padding: 12, cursor: file.url ? 'pointer' : 'default', position: 'relative', userSelect: 'none' }}
              onClick={() => file.url && window.open(file.url, '_blank')}
            >
              <button
                className="btn btn-ghost btn-sm"
                style={{
                  position: 'absolute', top: 6, right: 6, padding: '2px 6px',
                  fontSize: 11, lineHeight: 1, color: 'var(--text-muted)',
                }}
                onClick={e => handleDelete(e, file)}
                title="Delete"
              >
                ✕
              </button>
              <div style={{ fontSize: 28, marginBottom: 8 }}>{fileIcon(file.content_type)}</div>
              <div
                className="font-medium text-sm"
                style={{
                  overflow: 'hidden', display: '-webkit-box',
                  WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  wordBreak: 'break-all', marginBottom: 6, lineHeight: 1.4,
                }}
              >
                {file.filename || '—'}
              </div>
              <div className="text-xs td-muted" style={{ marginBottom: 4 }}>{fmtSize(file.file_size)}</div>
              {(file.entity_type || file.entity_id) && (
                <div style={{ marginBottom: 4 }}>
                  <span className="badge badge-blue text-xs" style={{ fontSize: 10 }}>
                    {[file.entity_type, file.entity_id ? file.entity_id.slice(0, 8) : null].filter(Boolean).join('/')}
                  </span>
                </div>
              )}
              <div className="text-xs td-muted">{fmtDate(file.created_at)}</div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={showLinkModal}
        onClose={() => { setShowLinkModal(false); setLinkForm(emptyLinkForm) }}
        title="Link File"
        footer={
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => { setShowLinkModal(false); setLinkForm(emptyLinkForm) }}>Cancel</button>
            <button
              className="btn btn-primary"
              disabled={linkMut.isPending || !linkForm.entity_id || !linkForm.filename || !linkForm.url}
              onClick={submitLink}
            >
              {linkMut.isPending ? 'Linking…' : 'Link File'}
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Entity Type</label>
          <select
            className="form-input"
            value={linkForm.entity_type}
            onChange={e => setLinkForm(f => ({ ...f, entity_type: e.target.value }))}
          >
            {ENTITY_TYPES.map(t => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Entity ID *</label>
          <input
            className="form-input"
            placeholder="e.g. lead_abc123"
            value={linkForm.entity_id}
            onChange={e => setLinkForm(f => ({ ...f, entity_id: e.target.value }))}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Filename *</label>
          <input
            className="form-input"
            placeholder="document.pdf"
            value={linkForm.filename}
            onChange={e => setLinkForm(f => ({ ...f, filename: e.target.value }))}
          />
        </div>
        <div className="form-group">
          <label className="form-label">URL *</label>
          <input
            className="form-input"
            placeholder="https://…"
            value={linkForm.url}
            onChange={e => setLinkForm(f => ({ ...f, url: e.target.value }))}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Content Type</label>
          <input
            className="form-input"
            placeholder="application/pdf"
            value={linkForm.content_type}
            onChange={e => setLinkForm(f => ({ ...f, content_type: e.target.value }))}
          />
        </div>
        <div className="form-group">
          <label className="form-label">File Size (bytes)</label>
          <input
            className="form-input"
            type="number"
            placeholder="102400"
            value={linkForm.file_size}
            onChange={e => setLinkForm(f => ({ ...f, file_size: e.target.value }))}
          />
        </div>
        {linkMut.isError && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{linkMut.error.message}</p>}
      </Modal>
    </div>
  )
}
