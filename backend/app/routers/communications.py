from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user
from app.models import User, Communication, Lead
from app.schemas import CommunicationCreate, CommunicationOut

router = APIRouter(prefix="/communications", tags=["communications"])

@router.get("", response_model=list[CommunicationOut])
def list_communications(lead_id: str | None = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(Communication).filter(Communication.organization_id == user.organization_id)
    if lead_id:
        query = query.filter(Communication.lead_id == lead_id)
    return query.order_by(Communication.created_at.desc()).all()

@router.post("", response_model=CommunicationOut)
def create_communication(payload: CommunicationCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if payload.lead_id:
        lead = db.query(Lead).filter(Lead.id == payload.lead_id, Lead.organization_id == user.organization_id).first()
        if not lead:
            raise HTTPException(404, "Lead not found")
    comm = Communication(**payload.model_dump(), organization_id=user.organization_id)
    db.add(comm); db.commit(); db.refresh(comm)
    return comm
