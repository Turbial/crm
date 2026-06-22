from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user
from app.models import User, Campaign
from app.schemas import CampaignCreate, CampaignOut

router = APIRouter(prefix="/campaigns", tags=["campaigns"])

@router.get("", response_model=list[CampaignOut])
def list_items(limit: int = 100, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Campaign).filter(Campaign.organization_id == user.organization_id).order_by(Campaign.created_at.desc()).limit(limit).all()

@router.post("", response_model=CampaignOut)
def create_item(payload: CampaignCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = Campaign(**payload.model_dump(), organization_id=user.organization_id)
    db.add(item); db.commit(); db.refresh(item)
    return item

@router.get("/{item_id}", response_model=CampaignOut)
def get_item(item_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.query(Campaign).filter(Campaign.id == item_id, Campaign.organization_id == user.organization_id).first()
    if not item:
        raise HTTPException(404, "Item not found")
    return item

@router.patch("/{item_id}", response_model=CampaignOut)
def update_item(item_id: str, payload: CampaignCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.query(Campaign).filter(Campaign.id == item_id, Campaign.organization_id == user.organization_id).first()
    if not item:
        raise HTTPException(404, "Item not found")
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(item, key, value)
    db.commit(); db.refresh(item)
    return item

@router.delete("/{item_id}")
def delete_item(item_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.query(Campaign).filter(Campaign.id == item_id, Campaign.organization_id == user.organization_id).first()
    if not item:
        raise HTTPException(404, "Item not found")
    db.delete(item); db.commit()
    return {"ok": True}
