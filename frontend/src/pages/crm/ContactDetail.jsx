import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Edit2, Mail, Phone, Trash2, FileText, MessageSquare, StickyNote, Clock, LayoutGrid } from 'lucide-react'
import { get, patch, del } from '../../api'
import {
  Spinner, Badge, EmptyState, Modal, Avatar, TabBar, Timeline,
  DataTable, DetailRow, SectionCard, FormField, ErrorMessage,
  ConfirmDialog, RelativeTime, MoneyDisplay,
} from '../../components'

const TABS = [
  { key: 'overview',        label: 'Overview',        icon: LayoutGrid },
  { key: 'deals',          label: 'Deals',            icon: FileText },
  { key: 'communications', label: 'Communications',   icon: MessageSquare },
  { key: 'notes',          label: 'Notes',            icon: StickyNote },
  { key: 'timeline',       label: 'Timeline',         icon: Clock },
]

const STAGE_COLORS = {
  prospect: 'blue', qualified: 'purple', proposal: 'yellow',
  negotiation: 'yellow', won: 'green', lost: 'red', closed: 'gray',
}

const CHANNEL_COLORS = {
  email: 'blue', phone: 'green', sms: 'yellow', chat: 'purple', in_person: 'gray',
}

const DIRECTION_COLORS = {
  inbound: 'green', outbound: 'blue',
}

export default function ContactDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [activeTab, setActiveTab]       = useState('overview')
  const [editOpen, setEditOpen]         = useState(false)
  const [deleteOpen, setDeleteOpen]     = useState(false)
  const [editForm, setEditForm]         = useState({})

  // ── Primary contact query ──────────────────────────────────────────────────
  const { data: contact, isLoading } = useQuery({
    queryKey: ['contact', id],
    queryFn: () => get(`/contacts/${id}`),
  })

  // ── Linked lead ────────────────────────────────────────────────────────────
  const { data: linkedLead } = useQuery({
    queryKey: ['lead', contact?.lead_id],
    queryFn: () => get(`/leads/${contact.lead_id}`),
    enabled: !!contact?.lead_id,
    retry: false,
  })

  // ── Tab data queries ───────────────────────────────────────────────────────
  const { data: allDeals = [], isLoading: dealsLoading } = useQuery({
    queryKey: ['deals'],
    queryFn: () => get('/deals?limit=500'),
    enabled: activeTab === 'deals',
  })

  const { data: allComms = [], isLoading: commsLoading } = useQuery({
    queryKey: ['communications'],
    queryFn: () => get('/communications?limit=500'),
    enabled: activeTab === 'communications',
  })

  const { data: notes = [], isLoading: notesLoading } = useQuery({
    queryKey: ['notes', 'lead', contact?.lead_id],
    queryFn: () => get(`/notes?lead_id=${contact.lead_id}`),
    enabled: activeTab === 'notes' && !!contact?.lead_id,
  })

  const { data: timelineEvents = [], isLoading: timelineLoading } = useQuery({
    queryKey: ['timeline', 'lead', contact?.lead_id],
    queryFn: () => get(`/timeline/lead/${contact.lead_id}`),
    enabled: activeTab === 'timeline' && !!contact?.lead_id,
    retry: false,
  })

  // ── Mutations ──────────────────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: body => patch(`/contacts/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contact', id] })
      setEditOpen(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => del(`/contacts/${id}`),
    onSuccess: () => navigate('/crm/contacts'),
  })

  // ── Loading / not found ───────────────────────────────────────────────────
  if (isLoading) return <Spinner />
  if (!contact) return <p className="text-muted">Contact not found.</p>

  // ── Helpers ────────────────────────────────────────────────────────────────
  function openEdit() {
    setEditForm({
      name:  contact.name  || '',
      title: contact.title || '',
      email: contact.email || '',
      phone: contact.phone || '',
    })
    setEditOpen(true)
  }

  function setField(key) {
    return e => setEditForm(f => ({ ...f, [key]: e.target.value }))
  }

  const deals = allDeals.filter(d => d.contact_id === contact.id)
  const comms  = allComms.filter(c => c.lead_id === contact.lead_id)

  // ── Tab content ────────────────────────────────────────────────────────────
  function renderOverview() {
    return (
      <div className="two-col" style={{ alignItems: 'start' }}>
        {/* Left column — field grid */}
        <SectionCard
          title="Contact Details"
          action={
            <button className="btn btn-secondary btn-sm flex gap-1 items-center" onClick={openEdit}>
              <Edit2 size={13} /> Edit
            </button>
          }
        >
          <div style={{ display: 'grid', gap: 16 }}>
            <DetailRow label="Name"  value={contact.name} />
            <DetailRow label="Title" value={contact.title} />
            <DetailRow label="Email">
              {contact.email
                ? <a href={`mailto:${contact.email}`} style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--accent)' }}>{contact.email}</a>
                : <span style={{ fontSize: 13.5, fontWeight: 500 }}>—</span>}
            </DetailRow>
            <DetailRow label="Phone">
              {contact.phone
                ? <a href={`tel:${contact.phone}`} style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--accent)' }}>{contact.phone}</a>
                : <span style={{ fontSize: 13.5, fontWeight: 500 }}>—</span>}
            </DetailRow>
            <DetailRow label="Lead">
              {contact.lead_id
                ? <Link to={`/crm/leads/${contact.lead_id}`} style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--accent)' }}>
                    {linkedLead?.name || contact.lead_id}
                  </Link>
                : <span style={{ fontSize: 13.5, fontWeight: 500 }}>—</span>}
            </DetailRow>
            <DetailRow label="Company" value={linkedLead?.company} />
            <DetailRow label="Created At">
              <span style={{ fontSize: 13.5, fontWeight: 500 }}>
                {contact.created_at ? new Date(contact.created_at).toLocaleDateString() : '—'}
              </span>
            </DetailRow>
          </div>
        </SectionCard>

        {/* Right column — linked lead card */}
        {linkedLead && (
          <SectionCard title="Linked Lead">
            <div
              className="flex items-center justify-between"
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/crm/leads/${linkedLead.id}`)}
            >
              <div>
                <div className="font-medium" style={{ fontSize: 14 }}>{linkedLead.name}</div>
                {linkedLead.company && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{linkedLead.company}</div>
                )}
              </div>
              <Badge label={linkedLead.status} />
            </div>
          </SectionCard>
        )}
      </div>
    )
  }

  function renderDeals() {
    const columns = [
      {
        key: 'name',
        label: 'Deal Name',
        render: row => (
          <Link to={`/crm/deals/${row.id}`} style={{ color: 'var(--accent)', fontWeight: 500 }}>
            {row.name || '—'}
          </Link>
        ),
      },
      {
        key: 'stage',
        label: 'Stage',
        render: row => <Badge label={row.stage} color={STAGE_COLORS[row.stage]} />,
      },
      {
        key: 'value',
        label: 'Value',
        render: row => <MoneyDisplay amount={row.value} />,
      },
      {
        key: 'close_date',
        label: 'Close Date',
        render: row => row.close_date ? new Date(row.close_date).toLocaleDateString() : '—',
      },
      {
        key: 'status',
        label: 'Status',
        render: row => <Badge label={row.status} />,
      },
    ]

    return (
      <DataTable
        columns={columns}
        data={deals}
        isLoading={dealsLoading}
        emptyIcon={FileText}
        emptyTitle="No deals"
        emptyDescription="No deals are linked to this contact yet."
      />
    )
  }

  function renderCommunications() {
    const columns = [
      {
        key: 'created_at',
        label: 'Date',
        render: row => row.created_at ? new Date(row.created_at).toLocaleString() : '—',
      },
      {
        key: 'channel',
        label: 'Channel',
        render: row => <Badge label={row.channel} color={CHANNEL_COLORS[row.channel]} />,
      },
      {
        key: 'direction',
        label: 'Direction',
        render: row => <Badge label={row.direction} color={DIRECTION_COLORS[row.direction]} />,
      },
      {
        key: 'subject',
        label: 'Subject',
        render: row => <span style={{ fontWeight: 500 }}>{row.subject || '—'}</span>,
      },
      {
        key: 'body',
        label: 'Preview',
        render: row => (
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
            {row.body ? row.body.slice(0, 80) + (row.body.length > 80 ? '…' : '') : '—'}
          </span>
        ),
      },
    ]

    return (
      <DataTable
        columns={columns}
        data={comms}
        isLoading={commsLoading}
        emptyIcon={MessageSquare}
        emptyTitle="No communications"
        emptyDescription="No communications are linked to this contact's lead yet."
      />
    )
  }

  function renderNotes() {
    if (notesLoading) return <Spinner />
    if (!notes.length) {
      return (
        <EmptyState
          icon={StickyNote}
          title="No notes"
          description="No notes have been added to this contact's lead yet."
        />
      )
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {notes.map(note => (
          <div key={note.id} className="card" style={{ padding: '14px 18px' }}>
            <p style={{ fontSize: 14, margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{note.content}</p>
            <div style={{ marginTop: 8 }}>
              <RelativeTime date={note.created_at} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  function renderTimeline() {
    if (timelineLoading) return <Spinner />
    return <Timeline events={timelineEvents} />
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Back link */}
      <button
        className="btn btn-ghost btn-sm flex gap-1 items-center"
        style={{ marginBottom: 20, color: 'var(--text-muted)' }}
        onClick={() => navigate('/crm/contacts')}
      >
        <ArrowLeft size={15} /> Back
      </button>

      {/* Hero header */}
      <div className="flex gap-4 items-start" style={{ marginBottom: 24 }}>
        <Avatar name={contact.name} size={60} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>{contact.name}</h1>
          {(contact.title || linkedLead?.company) && (
            <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>
              {[contact.title, linkedLead?.company].filter(Boolean).join(' at ')}
            </div>
          )}
          <div className="flex gap-3 items-center" style={{ marginTop: 6, flexWrap: 'wrap' }}>
            {contact.email && (
              <a
                href={`mailto:${contact.email}`}
                style={{ fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none' }}
              >
                {contact.email}
              </a>
            )}
            {contact.phone && (
              <a
                href={`tel:${contact.phone}`}
                style={{ fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none' }}
              >
                {contact.phone}
              </a>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 items-center" style={{ flexShrink: 0 }}>
          <button
            className="btn btn-secondary btn-sm flex gap-1 items-center"
            onClick={openEdit}
          >
            <Edit2 size={13} /> Edit
          </button>
          {contact.email && (
            <button
              className="btn btn-secondary btn-sm flex gap-1 items-center"
              onClick={() => { window.location = `mailto:${contact.email}` }}
            >
              <Mail size={13} /> Send Email
            </button>
          )}
          {contact.phone && (
            <button
              className="btn btn-secondary btn-sm flex gap-1 items-center"
              onClick={() => { window.location = `tel:${contact.phone}` }}
            >
              <Phone size={13} /> Call
            </button>
          )}
          <button
            className="btn btn-danger btn-sm flex gap-1 items-center"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 size={13} /> Delete
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} variant="underline" />

      {/* Tab content */}
      <div style={{ marginTop: 4 }}>
        {activeTab === 'overview'        && renderOverview()}
        {activeTab === 'deals'           && renderDeals()}
        {activeTab === 'communications'  && renderCommunications()}
        {activeTab === 'notes'           && renderNotes()}
        {activeTab === 'timeline'        && renderTimeline()}
      </div>

      {/* Edit Modal */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Contact"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setEditOpen(false)} disabled={updateMutation.isPending}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              disabled={updateMutation.isPending}
              onClick={() => updateMutation.mutate(editForm)}
            >
              {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </>
        }
      >
        <FormField
          label="Name"
          required
          value={editForm.name || ''}
          onChange={setField('name')}
          placeholder="Full name"
          autoFocus
        />
        <FormField
          label="Title"
          value={editForm.title || ''}
          onChange={setField('title')}
          placeholder="Job title"
        />
        <FormField
          label="Email"
          type="email"
          value={editForm.email || ''}
          onChange={setField('email')}
          placeholder="email@example.com"
        />
        <FormField
          label="Phone"
          type="tel"
          value={editForm.phone || ''}
          onChange={setField('phone')}
          placeholder="+1 555 000 0000"
        />
        {updateMutation.isError && (
          <ErrorMessage error={updateMutation.error} />
        )}
      </Modal>

      {/* Delete ConfirmDialog */}
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete Contact"
        message={`Are you sure you want to delete "${contact.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}
