import { useState, useRef } from 'react'
import Badge from './Badge'

/**
 * HTML5 drag-and-drop kanban board.
 *
 * columns: [{ column: { id, label }, tasks: [...], count, wip_over_limit }]
 * onCardMove(task, targetColumn) — called when a card is dropped in a new column
 * onCardClick(task) — called on card click (only fires if not a drag)
 * renderCard(task, column) — optional custom card renderer
 */
export default function KanbanBoard({ columns, onCardClick, onCardMove, renderCard }) {
  const [dragging, setDragging] = useState(null)      // { task, fromColId }
  const [overCol, setOverCol]   = useState(null)       // column id being dragged over
  const [overCard, setOverCard] = useState(null)       // card id being dragged over
  const dragMoved = useRef(false)

  if (!columns?.length) return <p className="text-muted">No board data.</p>

  function handleDragStart(e, task, colId) {
    dragMoved.current = false
    setDragging({ task, fromColId: colId })
    e.dataTransfer.effectAllowed = 'move'
    // ghost image — use the card element itself
    e.dataTransfer.setDragImage(e.currentTarget, 20, 20)
  }

  function handleDragEnd() {
    setDragging(null)
    setOverCol(null)
    setOverCard(null)
  }

  function handleColDragOver(e, colId) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    dragMoved.current = true
    if (overCol !== colId) setOverCol(colId)
  }

  function handleCardDragOver(e, cardId) {
    e.preventDefault()
    e.stopPropagation()
    dragMoved.current = true
    if (overCard !== cardId) setOverCard(cardId)
  }

  function handleDrop(e, targetCol) {
    e.preventDefault()
    if (!dragging) return
    const { task, fromColId } = dragging
    if (targetCol.id !== fromColId) {
      onCardMove?.(task, targetCol)
    }
    setDragging(null)
    setOverCol(null)
    setOverCard(null)
  }

  function handleCardClick(task) {
    if (dragMoved.current) return   // suppress click after drag
    onCardClick?.(task)
  }

  return (
    <div className="kanban-wrap">
      {columns.map(({ column, tasks = [], count, wip_over_limit }) => {
        const isOver = overCol === column.id
        return (
          <div
            key={column.id}
            className="kanban-col"
            style={{
              borderColor: wip_over_limit ? '#d97706' : isOver ? 'var(--accent)' : undefined,
              background: isOver ? 'var(--accent-soft)' : undefined,
              transition: 'background .12s, border-color .12s',
            }}
            onDragOver={e => handleColDragOver(e, column.id)}
            onDrop={e => handleDrop(e, column)}
          >
            <div className="kanban-col-header">
              <h3>{column.label}</h3>
              <span
                className="kanban-count"
                style={wip_over_limit ? { background: '#fef3c7', color: '#d97706' } : {}}
              >
                {count}
              </span>
            </div>

            {tasks.map(task => {
              const isDraggingThis = dragging?.task?.id === task.id
              const isOverThis     = overCard === task.id
              return (
                <div
                  key={task.id}
                  className="kanban-card"
                  draggable
                  onDragStart={e => handleDragStart(e, task, column.id)}
                  onDragEnd={handleDragEnd}
                  onDragOver={e => handleCardDragOver(e, task.id)}
                  onClick={() => handleCardClick(task)}
                  style={{
                    opacity: isDraggingThis ? 0.4 : 1,
                    cursor: 'grab',
                    outline: isOverThis ? '2px dashed var(--accent)' : undefined,
                    transition: 'opacity .15s, outline .1s',
                  }}
                >
                  {renderCard ? renderCard(task, column) : (
                    <>
                      <div className="kanban-card-title">{task.title}</div>
                      <div className="kanban-card-meta">
                        <Badge label={task.priority || 'medium'} />
                        {task.assignee_agent && <span>{task.assignee_agent}</span>}
                      </div>
                    </>
                  )}
                </div>
              )
            })}

            {/* Drop zone visual at bottom of empty columns */}
            {tasks.length === 0 && isOver && (
              <div style={{
                height: 60, border: '2px dashed var(--accent)', borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, color: 'var(--accent)', opacity: 0.7,
              }}>
                Drop here
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
