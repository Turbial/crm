import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Mail } from 'lucide-react'
import { get, post, patch, del } from '../../api'
import Spinner from '../../components/Spinner'
import EmptyState from '../../components/EmptyState'
import Modal from '../../components/Modal'

const BLANK = { name: '', subject: '', body_html: '', category: '' }

export default function EmailTemplates() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['email-templates'],
    queryFn: () => get('/email-templates', { limit: 100 }),
  })

  const createMut = useMutation({
    mutationFn: body => post('/email-templates', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['email-templates'] }); closeModal() },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, body }) => patch(`/email-templates/${id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['email-templates'] }); closeModal() },
  })

  const deleteMut = useMutation({
    mutationFn: id => del(`/email-templates/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['email-templates'] }); closeModal() },
  })

  function openCreate() {
    setEditing(null)
    setForm(BLANK)
    setConfirmDelete(false)
    setShowModal(true)
  }

  function openEdit(t) {
    setEditing(t)
    setForm({ name: t.name, subject: t.subject, body_html: t.body_html || '', category: t.category || '' })
    setConfirmDelete(false)
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditing(null)
    setForm(BLANK)
    setConfirmDelete(false)
  }

  function handleSave() {
    if (editing) {
      updateMut.mutate({ id: editing.id, body: form })
    } else {
      createMut.mutate(form)
    }
  }

  const isBusy = createMut.isPending || updateMut.isPending
  const mutError = createMut.error || updateMut.error

  if (isLoading) return <Spinner />

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Email Templates</h1>
          <p>{templates.length} template{templates.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <Plus size={15} /> New Template
        </button>
      </div>

      {templates.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="No templates yet"
          description="Create reusable email templates for your campaigns and sequences."
          action={<button className="btn btn-primary" onClick={openCreate}>New Template</button>}
        />
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Subject</th>
                  <th>Category</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {templates.map(t => (
                  <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => openEdit(t)}>
                    <td className="font-medium">{t.name}</td>
                    <td className="td-muted text-sm" style={{ maxWidth: 260 }}>
                      <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.subject}
                      </span>
                    </td>
                    <td className="td-muted text-sm">{t.category || '—'}</td>
                    <td className="td-muted text-sm">{new Date(t.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={showModal}
        onClose={closeModal}
        title={editing ? 'Edit Template' : 'New Template'}
        footer={
          <div className="flex gap-2 items-center" style={{ justifyContent: 'space-between', width: '100%' }}>
            <div>
              {editing && !confirmDelete && (
                <button className="btn btn-danger btn-sm" onClick={() => setConfirmDelete(true)}>
                  Delete
                </button>
              )}
              {editing && confirmDelete && (
                <div className="flex gap-2 items-center">
                  <span className="text-sm" style={{ color: 'var(--danger)' }}>Sure?</span>
                  <button
                    className="btn btn-danger btn-sm"
                    disabled={deleteMut.isPending}
                    onClick={() => deleteMut.mutate(editing.id)}
                  >
                    {deleteMut.isPending ? 'Deleting…' : 'Yes, delete'}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(false)}>Cancel</button>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button className="btn btn-secondary btn-sm" onClick={closeModal}>Cancel</button>
              <button className="btn btn-primary" disabled={isBusy || !form.name.trim()} onClick={handleSave}>
                {isBusy ? 'Saving…' : editing ? 'Save' : 'Create'}
              </button>
            </div>
          </div>
        }
      >
        <div className="form-group">
          <label className="form-label">Name *</label>
          <input
            className="form-input"
            autoFocus
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Template name"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Subject</label>
          <input
            className="form-input"
            value={form.subject}
            onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
            placeholder="Email subject line"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Category</label>
          <input
            className="form-input"
            value={form.category}
            onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
            placeholder="e.g. onboarding, newsletter"
          />
        </div>
        <div className="form-group">
          <label className="form-label">HTML Body</label>
          <textarea
            className="form-input"
            rows={8}
            value={form.body_html}
            onChange={e => setForm(f => ({ ...f, body_html: e.target.value }))}
            placeholder="<p>Your email HTML here…</p>"
            style={{ fontFamily: 'monospace', fontSize: 13, resize: 'vertical' }}
          />
        </div>
        {mutError && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{mutError.message}</p>}
      </Modal>
    </div>
  )
}
