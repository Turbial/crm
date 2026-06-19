from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user
from app.models import User, ProductService
from app.schemas import ProductServiceCreate, ProductServiceOut

router = APIRouter(prefix="/products-services", tags=["products-services"])

@router.get("", response_model=list[ProductServiceOut])
def list_items(limit: int = 100, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(ProductService).filter(ProductService.organization_id == user.organization_id).order_by(ProductService.created_at.desc()).limit(limit).all()

@router.post("", response_model=ProductServiceOut)
def create_item(payload: ProductServiceCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = ProductService(**payload.model_dump(), organization_id=user.organization_id)
    db.add(item); db.commit(); db.refresh(item)
    return item

@router.get("/{item_id}", response_model=ProductServiceOut)
def get_item(item_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.query(ProductService).filter(ProductService.id == item_id, ProductService.organization_id == user.organization_id).first()
    if not item:
        raise HTTPException(404, "Item not found")
    return item

@router.patch("/{item_id}", response_model=ProductServiceOut)
def update_item(item_id: str, payload: ProductServiceCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.query(ProductService).filter(ProductService.id == item_id, ProductService.organization_id == user.organization_id).first()
    if not item:
        raise HTTPException(404, "Item not found")
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(item, key, value)
    db.commit(); db.refresh(item)
    return item

@router.delete("/{item_id}")
def delete_item(item_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.query(ProductService).filter(ProductService.id == item_id, ProductService.organization_id == user.organization_id).first()
    if not item:
        raise HTTPException(404, "Item not found")
    db.delete(item); db.commit()
    return {"ok": True}
