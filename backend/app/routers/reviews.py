from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user
from app.models import User, ReviewRequest
from app.schemas import ReviewRequestCreate, ReviewRequestOut

router = APIRouter(prefix="/reviews", tags=["reviews"])

@router.get("", response_model=list[ReviewRequestOut])
def list_items(limit: int = 100, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(ReviewRequest).filter(ReviewRequest.organization_id == user.organization_id).order_by(ReviewRequest.created_at.desc()).limit(limit).all()

@router.post("", response_model=ReviewRequestOut)
def create_item(payload: ReviewRequestCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = ReviewRequest(**payload.model_dump(), organization_id=user.organization_id)
    db.add(item); db.commit(); db.refresh(item)
    return item

@router.get("/{item_id}", response_model=ReviewRequestOut)
def get_item(item_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.query(ReviewRequest).filter(ReviewRequest.id == item_id, ReviewRequest.organization_id == user.organization_id).first()
    if not item:
        raise HTTPException(404, "Item not found")
    return item

@router.patch("/{item_id}", response_model=ReviewRequestOut)
def update_item(item_id: str, payload: ReviewRequestCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.query(ReviewRequest).filter(ReviewRequest.id == item_id, ReviewRequest.organization_id == user.organization_id).first()
    if not item:
        raise HTTPException(404, "Item not found")
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(item, key, value)
    db.commit(); db.refresh(item)
    return item

@router.delete("/{item_id}")
def delete_item(item_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.query(ReviewRequest).filter(ReviewRequest.id == item_id, ReviewRequest.organization_id == user.organization_id).first()
    if not item:
        raise HTTPException(404, "Item not found")
    db.delete(item); db.commit()
    return {"ok": True}
