"""Custom field definition management."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_manager
from app.models import User, CustomFieldDefinition
from app.schemas import CustomFieldCreate, CustomFieldOut

router = APIRouter(prefix="/custom-fields", tags=["Custom Fields"])


@router.post("", response_model=CustomFieldOut)
def create_field(
    body: CustomFieldCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager),
):
    # Key must be unique per entity_type + org
    existing = db.query(CustomFieldDefinition).filter(
        CustomFieldDefinition.organization_id == user.organization_id,
        CustomFieldDefinition.entity_type == body.entity_type,
        CustomFieldDefinition.key == body.key,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Field '{body.key}' already exists for {body.entity_type}")

    field = CustomFieldDefinition(
        organization_id=user.organization_id,
        entity_type=body.entity_type,
        name=body.name,
        key=body.key,
        field_type=body.field_type,
        options=body.options,
        required=body.required,
        position=body.position,
        active=body.active,
    )
    db.add(field)
    db.commit()
    db.refresh(field)
    return field


@router.get("", response_model=list[CustomFieldOut])
def list_fields(
    entity_type: str | None = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(CustomFieldDefinition).filter(
        CustomFieldDefinition.organization_id == user.organization_id,
        CustomFieldDefinition.active == True,
    )
    if entity_type:
        q = q.filter(CustomFieldDefinition.entity_type == entity_type)
    return q.order_by(CustomFieldDefinition.entity_type, CustomFieldDefinition.position).all()


@router.patch("/{field_id}", response_model=CustomFieldOut)
def update_field(
    field_id: str,
    body: CustomFieldCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager),
):
    field = db.query(CustomFieldDefinition).filter(
        CustomFieldDefinition.id == field_id,
        CustomFieldDefinition.organization_id == user.organization_id,
    ).first()
    if not field:
        raise HTTPException(status_code=404, detail="Field not found")
    for attr, val in body.model_dump(exclude_unset=True).items():
        setattr(field, attr, val)
    db.commit()
    db.refresh(field)
    return field


@router.delete("/{field_id}", status_code=204)
def delete_field(
    field_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager),
):
    field = db.query(CustomFieldDefinition).filter(
        CustomFieldDefinition.id == field_id,
        CustomFieldDefinition.organization_id == user.organization_id,
    ).first()
    if not field:
        raise HTTPException(status_code=404, detail="Field not found")
    field.active = False
    db.commit()
