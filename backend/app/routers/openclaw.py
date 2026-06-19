from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.deps import get_current_user
from app.models import AgentAction, AgentMemory, User
from app.schemas import AgentActionOut
from app.services.openclaw_bridge import OpenClawBridge, OpenClawTask
from app.services.webhook_security import verify_signed_webhook

router = APIRouter(prefix="/openclaw", tags=["openclaw"])


class OpenClawTaskIn(BaseModel):
    agent_name: str = "ManagerAgent"
    task_type: str = "general"
    instruction: str
    priority: str = "normal"
    context: dict[str, Any] = {}
    requires_approval: bool = True


class OpenClawResultIn(BaseModel):
    organization_id: str | None = None
    status: str = "completed"
    summary: str
    crm_updates: list[dict[str, Any]] = []
    next_actions: list[str] = []
    evidence: list[Any] = []
    cost_cents: int = 0
    duration_ms: int = 0


class OpenClawMemoryIn(BaseModel):
    agent_name: str
    key: str
    value_json: dict[str, Any]
    source: str = "openclaw"


@router.get("/agents")
def list_openclaw_agents(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return {"agents": OpenClawBridge(db, user.organization_id, user.id).list_agents()}


@router.get("/prompts/{agent_name}")
def get_prompt(agent_name: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        return OpenClawBridge(db, user.organization_id, user.id).get_prompt(agent_name)
    except FileNotFoundError as exc:
        raise HTTPException(404, str(exc))


@router.get("/contract")
def contract(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return OpenClawBridge(db, user.organization_id, user.id).task_contract()


@router.post("/tasks", response_model=AgentActionOut)
def queue_task(payload: OpenClawTaskIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    bridge = OpenClawBridge(db, user.organization_id, user.id)
    return bridge.queue_task(OpenClawTask(**payload.model_dump()))


@router.post("/tasks/{action_id}/approve", response_model=AgentActionOut)
def approve_task(action_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        return OpenClawBridge(db, user.organization_id, user.id).approve_task(action_id)
    except ValueError as exc:
        raise HTTPException(404, str(exc))


@router.post("/tasks/{action_id}/result", response_model=AgentActionOut)
def record_result(action_id: str, payload: OpenClawResultIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        return OpenClawBridge(db, user.organization_id, user.id).record_result(action_id, payload.model_dump())
    except ValueError as exc:
        raise HTTPException(404, str(exc))


@router.get("/tasks", response_model=list[AgentActionOut])
def list_tasks(agent_name: Optional[str] = None, status: Optional[str] = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    q = db.query(AgentAction).filter(AgentAction.organization_id == user.organization_id)
    if agent_name:
        q = q.filter(AgentAction.agent_name == agent_name)
    if status:
        q = q.filter(AgentAction.status == status)
    return q.order_by(AgentAction.created_at.desc()).limit(100).all()


@router.post("/memory")
def upsert_memory(payload: OpenClawMemoryIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    memory = OpenClawBridge(db, user.organization_id, user.id).upsert_memory(
        payload.agent_name, payload.key, payload.value_json, payload.source
    )
    return {"id": memory.id, "agent_name": memory.agent_name, "key": memory.key, "value_json": memory.value_json}


@router.get("/memory/{agent_name}")
def list_memory(agent_name: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(AgentMemory).filter(AgentMemory.organization_id == user.organization_id, AgentMemory.agent_name == agent_name).all()
    return [{"key": r.key, "value_json": r.value_json, "source": r.source, "updated_at": r.updated_at} for r in rows]


@router.post("/callbacks/tasks/{action_id}/result")
async def signed_record_result(action_id: str, request: Request, db: Session = Depends(get_db)):
    """Signed machine-to-machine callback for OpenClaw workers.

    This endpoint does not require a user JWT. OpenClaw must send either:
    - X-Mighty-Timestamp + X-Mighty-Signature using OPENCLAW_WEBHOOK_SECRET, or
    - legacy X-Mighty-Webhook-Secret for local testing.

    Payload must include `organization_id` so the action is resolved within the
    correct tenant boundary.
    """
    body = await verify_signed_webhook(request, secret=settings.openclaw_webhook_secret)
    raw = OpenClawResultIn.model_validate_json(body)
    payload = raw.model_dump()
    organization_id = payload.pop("organization_id", None) if "organization_id" in payload else None
    if not organization_id:
        # Also support organization_id inside evidence/context-style payloads.
        organization_id = raw.model_dump().get("organization_id")
    if not organization_id:
        raise HTTPException(422, "organization_id is required for signed OpenClaw callbacks")
    try:
        return OpenClawBridge(db, organization_id, None).record_result(action_id, payload)
    except ValueError as exc:
        raise HTTPException(404, str(exc))
