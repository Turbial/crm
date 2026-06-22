from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.schemas import (
    KanbanBoardOut, KanbanColumnCreate, KanbanColumnOut, KanbanColumnUpdate,
    KanbanMoveTaskIn, PMTaskOut, PMBotCommandHelpOut,
)
from app.services.kanban_service import KanbanService

router = APIRouter(prefix="/projects/{project_id}/kanban", tags=["kanban"])

@router.post("/defaults", response_model=list[KanbanColumnOut])
def create_default_kanban_columns(project_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return KanbanService(db, user.organization_id, user.id).ensure_columns(project_id)

@router.get("", response_model=KanbanBoardOut)
def get_kanban_board(project_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return KanbanService(db, user.organization_id, user.id).board(project_id)

@router.post("/columns", response_model=KanbanColumnOut)
def create_kanban_column(project_id: str, payload: KanbanColumnCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return KanbanService(db, user.organization_id, user.id).add_column(project_id, **payload.model_dump())

@router.patch("/columns/{column_id}", response_model=KanbanColumnOut)
def update_kanban_column(project_id: str, column_id: str, payload: KanbanColumnUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return KanbanService(db, user.organization_id, user.id).update_column(project_id, column_id, payload.model_dump(exclude_unset=True))

@router.patch("/tasks/{task_id}/move")
def move_kanban_task(project_id: str, task_id: str, payload: KanbanMoveTaskIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    result = KanbanService(db, user.organization_id, user.id).move_task(
        project_id=project_id,
        task_id=task_id,
        column_key=payload.column_key,
        status=payload.status,
        position=payload.position,
        blocked_reason=payload.blocked_reason,
        output_summary=payload.output_summary,
        queue_openclaw=payload.queue_openclaw,
    )
    return {
        "task": result.task,
        "old_status": result.old_status,
        "new_status": result.new_status,
        "queued_agent_action_id": result.queued_agent_action_id,
    }

@router.get("/bot-help", response_model=PMBotCommandHelpOut)
def pm_bot_command_help(project_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    KanbanService(db, user.organization_id, user.id).ensure_project(project_id)
    return {
        "categories": {
            "board": [
                "Show Kanban board",
                "Show board for ABC Roofing Website",
                "What is blocked?",
            ],
            "move": [
                "Move task 4f1a2b3c to in progress",
                "Move task 'Generate homepage copy' to review",
                "Mark task 4f1a2b3c done",
                "Block task 4f1a2b3c because waiting for logo",
            ],
            "create": [
                "Create PM task write homepage copy for ABC Roofing",
                "Create PM task QA mobile homepage and assign to QAAgent",
            ],
            "agents": [
                "Ask WebsiteAgent to continue next ready task",
                "Queue task 4f1a2b3c to OpenClaw",
            ],
        }
    }
