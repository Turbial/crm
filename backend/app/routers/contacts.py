from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user
from app.models import User, Contact, Lead
from app.schemas import ContactCreate, ContactOut

router = APIRouter(prefix="/contacts", tags=["contacts"])

@router.get("", response_model=list[ContactOut])
def list_contacts(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Contact).filter(Contact.organization_id == user.organization_id).order_by(Contact.created_at.desc()).all()

@router.post("", response_model=ContactOut)
def create_contact(payload: ContactCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if payload.lead_id:
        lead = db.query(Lead).filter(Lead.id == payload.lead_id, Lead.organization_id == user.organization_id).first()
        if not lead:
            raise HTTPException(404, "Lead not found")
    contact = Contact(**payload.model_dump(), organization_id=user.organization_id)
    db.add(contact); db.commit(); db.refresh(contact)
    return contact
