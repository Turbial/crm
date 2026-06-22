from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user
from app.models import User, Quote
from app.schemas import QuoteCreate, QuoteUpdate, QuoteOut

router = APIRouter(prefix="/quotes", tags=["quotes"])

@router.get("", response_model=list[QuoteOut])
def list_items(limit: int = 100, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Quote).filter(Quote.organization_id == user.organization_id).order_by(Quote.created_at.desc()).limit(limit).all()

@router.post("", response_model=QuoteOut)
def create_item(payload: QuoteCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = Quote(**payload.model_dump(), organization_id=user.organization_id)
    db.add(item); db.commit(); db.refresh(item)
    return item

@router.get("/{item_id}", response_model=QuoteOut)
def get_item(item_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.query(Quote).filter(Quote.id == item_id, Quote.organization_id == user.organization_id).first()
    if not item:
        raise HTTPException(404, "Item not found")
    return item

@router.patch("/{item_id}", response_model=QuoteOut)
def update_item(item_id: str, payload: QuoteUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.query(Quote).filter(Quote.id == item_id, Quote.organization_id == user.organization_id).first()
    if not item:
        raise HTTPException(404, "Item not found")
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(item, key, value)
    db.commit(); db.refresh(item)
    return item

@router.delete("/{item_id}")
def delete_item(item_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.query(Quote).filter(Quote.id == item_id, Quote.organization_id == user.organization_id).first()
    if not item:
        raise HTTPException(404, "Item not found")
    db.delete(item); db.commit()
    return {"ok": True}
