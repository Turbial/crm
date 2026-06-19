from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.database import get_db
from app.deps import get_current_user, require_manager, require_staff
from app.models import User, Lead
from app.schemas import LeadCreate, LeadOut, LeadUpdate
from app.services import events

router = APIRouter(prefix="/leads", tags=["leads"])

@router.get("", response_model=list[LeadOut])
def list_leads(q: str | None = Query(default=None), status: str | None = None, limit: int = 100, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(Lead).filter(Lead.organization_id == user.organization_id)
    if q:
        like = f"%{q}%"
        query = query.filter(or_(Lead.name.ilike(like), Lead.company.ilike(like), Lead.email.ilike(like), Lead.phone.ilike(like)))
    if status:
        query = query.filter(Lead.status == status)
    return query.order_by(Lead.created_at.desc()).limit(limit).all()

@router.post("", response_model=LeadOut)
def create_lead(payload: LeadCreate, user: User = Depends(require_staff), db: Session = Depends(get_db)):
    lead = Lead(**payload.model_dump(), organization_id=user.organization_id)
    db.add(lead); db.commit(); db.refresh(lead)
    return lead

@router.get("/{lead_id}", response_model=LeadOut)
def get_lead(lead_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    lead = db.query(Lead).filter(Lead.id == lead_id, Lead.organization_id == user.organization_id).first()
    if not lead:
        raise HTTPException(404, "Lead not found")
    return lead

@router.patch("/{lead_id}", response_model=LeadOut)
def update_lead(lead_id: str, payload: LeadUpdate, user: User = Depends(require_staff), db: Session = Depends(get_db)):
    lead = db.query(Lead).filter(Lead.id == lead_id, Lead.organization_id == user.organization_id).first()
    if not lead:
        raise HTTPException(404, "Lead not found")
    updates = payload.model_dump(exclude_unset=True)
    old_status = lead.status
    for key, value in updates.items():
        setattr(lead, key, value)
    db.commit()
    db.refresh(lead)
    if "status" in updates and lead.status != old_status:
        events.emit("lead.status_changed", lead=lead, old_status=old_status, new_status=lead.status, db=db)
        db.commit()
    return lead

@router.delete("/{lead_id}")
def delete_lead(lead_id: str, user: User = Depends(require_manager), db: Session = Depends(get_db)):
    lead = db.query(Lead).filter(Lead.id == lead_id, Lead.organization_id == user.organization_id).first()
    if not lead:
        raise HTTPException(404, "Lead not found")
    db.delete(lead); db.commit()
    return {"ok": True}
