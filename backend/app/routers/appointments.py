from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user
from app.models import User, Appointment
from app.schemas import AppointmentCreate, AppointmentOut

router = APIRouter(prefix="/appointments", tags=["appointments"])

@router.get("", response_model=list[AppointmentOut])
def list_items(limit: int = 100, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Appointment).filter(Appointment.organization_id == user.organization_id).order_by(Appointment.created_at.desc()).limit(limit).all()

@router.post("", response_model=AppointmentOut)
def create_item(payload: AppointmentCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = Appointment(**payload.model_dump(), organization_id=user.organization_id)
    db.add(item); db.commit(); db.refresh(item)
    return item

@router.get("/{item_id}", response_model=AppointmentOut)
def get_item(item_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.query(Appointment).filter(Appointment.id == item_id, Appointment.organization_id == user.organization_id).first()
    if not item:
        raise HTTPException(404, "Item not found")
    return item

@router.patch("/{item_id}", response_model=AppointmentOut)
def update_item(item_id: str, payload: AppointmentCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.query(Appointment).filter(Appointment.id == item_id, Appointment.organization_id == user.organization_id).first()
    if not item:
        raise HTTPException(404, "Item not found")
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(item, key, value)
    db.commit(); db.refresh(item)
    return item

@router.delete("/{item_id}")
def delete_item(item_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.query(Appointment).filter(Appointment.id == item_id, Appointment.organization_id == user.organization_id).first()
    if not item:
        raise HTTPException(404, "Item not found")
    db.delete(item); db.commit()
    return {"ok": True}
