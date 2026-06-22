from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user
from app.models import User, Opportunity, Lead
from app.schemas import OpportunityCreate, OpportunityOut

router = APIRouter(prefix="/opportunities", tags=["opportunities"])

@router.get("", response_model=list[OpportunityOut])
def list_opportunities(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Opportunity).filter(Opportunity.organization_id == user.organization_id).order_by(Opportunity.created_at.desc()).all()

@router.post("", response_model=OpportunityOut)
def create_opportunity(payload: OpportunityCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    lead = db.query(Lead).filter(Lead.id == payload.lead_id, Lead.organization_id == user.organization_id).first()
    if not lead:
        raise HTTPException(404, "Lead not found")
    opp = Opportunity(**payload.model_dump(), organization_id=user.organization_id)
    db.add(opp); db.commit(); db.refresh(opp)
    return opp
