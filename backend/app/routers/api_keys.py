"""API key management endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_manager
from app.models import User, ApiKey
from app.schemas import ApiKeyCreate, ApiKeyOut, ApiKeyCreatedOut

router = APIRouter(prefix="/api-keys", tags=["API Keys"])


@router.post("", response_model=ApiKeyCreatedOut)
def create_key(
    body: ApiKeyCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager),
):
    from app.services.api_key_service import create_api_key
    row, raw = create_api_key(
        db=db,
        org_id=user.organization_id,
        name=body.name,
        scopes=body.scopes,
        user_id=user.id,
        expires_at=body.expires_at,
    )
    return ApiKeyCreatedOut.model_validate(row).model_copy(update={"raw_key": raw})


@router.get("", response_model=list[ApiKeyOut])
def list_keys(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return db.query(ApiKey).filter(
        ApiKey.organization_id == user.organization_id,
        ApiKey.active == True,
    ).order_by(ApiKey.created_at.desc()).all()


@router.delete("/{key_id}", status_code=204)
def revoke_key(
    key_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager),
):
    from app.services.api_key_service import revoke_api_key
    if not revoke_api_key(db, key_id, user.organization_id):
        raise HTTPException(status_code=404, detail="API key not found")
