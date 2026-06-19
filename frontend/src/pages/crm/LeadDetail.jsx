import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { get, patch, del } from '../../api'
import Spinner from '../../components/Spinner'
import Badge from '../../components/Badge'
import Timeline from '../../components/Timeline'

const STATUSES = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost']

export default function LeadDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: lead, isLoading } = useQuery({ queryKey: ['lead', id], queryFn: () => get(`/leads/${id}`) })
  const { data: timeline = [] } = useQuery({ queryKey: ['timeline', 'lead', id], queryFn: () => get(`/timeline/lead/${id}`) })

  const update = useMutation({
    mutationFn: body => patch(`/leads/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lead', id] }),
  })

  const remove = useMutation({
    mutationFn: () => del(`/leads/${id}`),
    onSuccess: () => navigate('/crm/leads'),
  })

  if (isLoading) return <Spinner />
  if (!lead) return <p className="text-muted">Lead not found.</p>

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button className="btn btn-ghost btn-icon" onClick={() => navigate(-1)}><ArrowLeft size={16} /></button>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>{lead.name}</h1>
        <Badge label={lead.status} />
      </div>

      <div className="two-col">
        {/* Details card */}
        <div className="card flex-col gap-3">
          <h3 className="font-semibold" style={{ fontSize: 14, marginBottom: 8 }}>Details</h3>
          {[
            ['Company', lead.company],
            ['Email', lead.email],
            ['Phone', lead.phone],
            ['Source', lead.source],
            ['Score', lead.score],
            ['City', lead.city],
            ['State', lead.state],
          ].map(([label, val]) => (
            <div key={label} className="flex justify-between" style={{ fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <span className="text-muted">{label}</span>
              <span className="font-medium">{val ?? '—'}</span>
            </div>
          ))}

          <div className="form-group mt-4">
            <label className="form-label">Update Status</label>
            <select className="form-input" value={lead.status} onChange={e => update.mutate({ status: e.target.value })}>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <button className="btn btn-danger btn-sm" style={{ marginTop: 8 }} onClick={() => { if (window.confirm('Delete lead?')) remove.mutate() }}>
            Delete Lead
          </button>
        </div>

        {/* Timeline */}
        <div className="card">
          <h3 className="font-semibold" style={{ fontSize: 14, marginBottom: 16 }}>Activity Timeline</h3>
          <Timeline events={timeline} />
        </div>
      </div>
    </div>
  )
}
