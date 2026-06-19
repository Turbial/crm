from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user
from app.models import User, Workflow
from app.services.workflow_engine import run_workflow

router = APIRouter(prefix="/workflow-runtime", tags=["workflow-runtime"])

class RunWorkflowRequest(BaseModel):
    lead_id: str | None = None

@router.post("/{workflow_id}/run")
def execute_workflow(workflow_id: str, payload: RunWorkflowRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id, Workflow.organization_id == user.organization_id).first()
    if not workflow: raise HTTPException(404, "Workflow not found")
    result = run_workflow(db, workflow, user.organization_id, payload.lead_id)
    return result.__dict__
