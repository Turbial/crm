from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user
from app.models import User, AgentAction, Lead
from app.schemas import AgentCommandIn, AgentActionOut
from app.services.agent_executor import get_executor

router = APIRouter(prefix="/agents", tags=["agents"])


@router.get("/actions", response_model=list[AgentActionOut])
def list_actions(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(AgentAction).filter(AgentAction.organization_id == user.organization_id).order_by(AgentAction.created_at.desc()).limit(100).all()


@router.post("/command", response_model=AgentActionOut)
def command(payload: AgentCommandIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if payload.lead_id:
        lead = db.query(Lead).filter(Lead.id == payload.lead_id, Lead.organization_id == user.organization_id).first()
        if not lead:
            raise HTTPException(404, "Lead not found")
    executor = get_executor(db, user.organization_id, user.id)
    action = executor.queue(
        agent_name=payload.agent_name,
        action_type=payload.action_type,
        instruction=payload.instruction,
        lead_id=payload.lead_id,
        metadata=getattr(payload, "metadata_json", None),
    )
    return executor.run(action)
