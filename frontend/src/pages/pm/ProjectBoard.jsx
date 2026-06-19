import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { get, patch } from '../../api'
import Spinner from '../../components/Spinner'
import Badge from '../../components/Badge'
import KanbanBoard from '../../components/KanbanBoard'

export default function ProjectBoard() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: project } = useQuery({ queryKey: ['project', id], queryFn: () => get(`/projects/${id}`) })
  const { data: kanban, isLoading } = useQuery({ queryKey: ['kanban', id], queryFn: () => get(`/projects/${id}/kanban`) })

  const moveTask = useMutation({
    mutationFn: ({ taskId, columnKey }) => patch(`/projects/${id}/kanban/tasks/${taskId}/move`, { column_key: columnKey }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kanban', id] }),
  })

  if (isLoading) return <Spinner />

  const COLUMNS = ['ready', 'in_progress', 'review', 'done']

  function renderCard(task, column) {
    return (
      <div key={task.id} className="kanban-card">
        <div className="kanban-card-title">{task.title}</div>
        <div className="kanban-card-meta">
          <Badge label={task.priority || 'medium'} />
          {task.assignee_agent && <span>{task.assignee_agent}</span>}
        </div>
        {task.blocked_reason && <div style={{ fontSize: 12, color: 'var(--warning)', marginTop: 6 }}>{task.blocked_reason}</div>}
        <div className="flex gap-1 mt-4" style={{ flexWrap: 'wrap' }}>
          {COLUMNS.filter(c => c !== column.key).map(c => (
            <button key={c} className="btn btn-secondary btn-sm" onClick={() => moveTask.mutate({ taskId: task.id, columnKey: c })}>
              {c.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button className="btn btn-ghost btn-icon" onClick={() => navigate('/pm/projects')}><ArrowLeft size={16} /></button>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>{project?.name || 'Project Board'}</h1>
      </div>
      {kanban ? <KanbanBoard columns={kanban.columns} renderCard={renderCard} /> : <p className="text-muted">No board data.</p>}
    </div>
  )
}
