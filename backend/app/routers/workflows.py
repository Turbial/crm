from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload
from app.database import get_db
from app.deps import get_current_user
from app.models import User, Workflow, WorkflowStep, AgentAction
from app.schemas import WorkflowCreate, WorkflowOut, AgentActionOut
from app.services.agent_service import AgentService

router = APIRouter(prefix="/workflows", tags=["workflows"])

@router.get("", response_model=list[WorkflowOut])
def list_workflows(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Workflow).options(selectinload(Workflow.steps)).filter(Workflow.organization_id == user.organization_id).order_by(Workflow.created_at.desc()).all()

@router.post("", response_model=WorkflowOut)
def create_workflow(payload: WorkflowCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    data = payload.model_dump(exclude={"steps"})
    workflow = Workflow(**data, organization_id=user.organization_id)
    db.add(workflow); db.flush()
    for step in payload.steps:
        db.add(WorkflowStep(**step.model_dump(), workflow_id=workflow.id, organization_id=user.organization_id))
    db.commit(); db.refresh(workflow)
    return db.query(Workflow).options(selectinload(Workflow.steps)).filter(Workflow.id == workflow.id).first()

@router.post("/{workflow_id}/run", response_model=list[AgentActionOut])
def run_workflow(workflow_id: str, lead_id: str | None = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    workflow = db.query(Workflow).options(selectinload(Workflow.steps)).filter(Workflow.id == workflow_id, Workflow.organization_id == user.organization_id).first()
    if not workflow:
        raise HTTPException(404, "Workflow not found")
    results = []
    service = AgentService(db, user.organization_id)
    for step in sorted(workflow.steps, key=lambda s: s.position):
        action = AgentAction(organization_id=user.organization_id, lead_id=lead_id, agent_name="WorkflowAgent", action_type=step.action_type, instruction=step.instruction, metadata_json={"workflow_id": workflow.id, "step_id": step.id})
        db.add(action); db.commit(); db.refresh(action)
        results.append(service.execute_demo_action(action))
    return results
