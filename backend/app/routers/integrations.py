from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user
from app.models import User, IntegrationConnection
from app.schemas import IntegrationConnectionCreate, IntegrationConnectionOut

router = APIRouter(prefix="/integrations", tags=["integrations"])

@router.get("", response_model=list[IntegrationConnectionOut])
def list_items(limit: int = 100, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(IntegrationConnection).filter(IntegrationConnection.organization_id == user.organization_id).order_by(IntegrationConnection.created_at.desc()).limit(limit).all()

@router.post("", response_model=IntegrationConnectionOut)
def create_item(payload: IntegrationConnectionCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = IntegrationConnection(**payload.model_dump(), organization_id=user.organization_id)
    db.add(item); db.commit(); db.refresh(item)
    return item

@router.get("/{item_id}", response_model=IntegrationConnectionOut)
def get_item(item_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.query(IntegrationConnection).filter(IntegrationConnection.id == item_id, IntegrationConnection.organization_id == user.organization_id).first()
    if not item:
        raise HTTPException(404, "Item not found")
    return item

@router.patch("/{item_id}", response_model=IntegrationConnectionOut)
def update_item(item_id: str, payload: IntegrationConnectionCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.query(IntegrationConnection).filter(IntegrationConnection.id == item_id, IntegrationConnection.organization_id == user.organization_id).first()
    if not item:
        raise HTTPException(404, "Item not found")
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(item, key, value)
    db.commit(); db.refresh(item)
    return item

@router.delete("/{item_id}")
def delete_item(item_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.query(IntegrationConnection).filter(IntegrationConnection.id == item_id, IntegrationConnection.organization_id == user.organization_id).first()
    if not item:
        raise HTTPException(404, "Item not found")
    db.delete(item); db.commit()
    return {"ok": True}
