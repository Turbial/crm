import Badge from './Badge'

export default function KanbanBoard({ columns, onCardClick, renderCard }) {
  if (!columns?.length) return <p className="text-muted">No board data.</p>

  return (
    <div className="kanban-wrap">
      {columns.map(({ column, tasks = [], count, wip_over_limit }) => (
        <div key={column.id} className="kanban-col" style={wip_over_limit ? { borderColor: '#d97706' } : {}}>
          <div className="kanban-col-header">
            <h3>{column.label}</h3>
            <span className="kanban-count">{count}</span>
          </div>
          {tasks.map(task =>
            renderCard ? renderCard(task, column) : (
              <div key={task.id} className="kanban-card" onClick={() => onCardClick?.(task)}>
                <div className="kanban-card-title">{task.title}</div>
                <div className="kanban-card-meta">
                  <Badge label={task.priority || 'medium'} />
                  {task.assignee_agent && <span>{task.assignee_agent}</span>}
                </div>
              </div>
            )
          )}
        </div>
      ))}
    </div>
  )
}
