from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user
from app.models import User, Lead, Communication, Task
from app.services.lead_scoring import score_lead, recommended_next_action
from app.services.reporting_service import executive_report

router = APIRouter(prefix="/intelligence", tags=["intelligence"])

@router.get("/executive-report")
def get_executive_report(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return executive_report(db, user.organization_id)

@router.get("/leads/{lead_id}/score")
def lead_score(lead_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    lead = db.query(Lead).filter(Lead.id == lead_id, Lead.organization_id == user.organization_id).first()
    if not lead: raise HTTPException(404, "Lead not found")
    comms = db.query(Communication).filter(Communication.lead_id == lead.id, Communication.organization_id == user.organization_id).all()
    tasks = db.query(Task).filter(Task.lead_id == lead.id, Task.organization_id == user.organization_id).all()
    breakdown = score_lead(lead, comms, tasks)
    return {"lead_id": lead.id, "score": breakdown.score, "reasons": breakdown.reasons}

@router.get("/leads/{lead_id}/next-action")
def next_action(lead_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    lead = db.query(Lead).filter(Lead.id == lead_id, Lead.organization_id == user.organization_id).first()
    if not lead: raise HTTPException(404, "Lead not found")
    comms = db.query(Communication).filter(Communication.lead_id == lead.id, Communication.organization_id == user.organization_id).all()
    return recommended_next_action(lead, comms)
