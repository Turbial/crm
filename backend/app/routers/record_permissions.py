"""Record-level permission endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_manager
from app.models import User
from app.schemas import RecordPermissionCreate, RecordPermissionOut

router = APIRouter(prefix="/permissions", tags=["Record Permissions"])


@router.get("/{entity_type}/{entity_id}", response_model=list[RecordPermissionOut])
def list_permissions(
    entity_type: str,
    entity_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.services.record_permission_service import list_permissions as _list
    return _list(db, user.organization_id, entity_type, entity_id)


@router.post("/{entity_type}/{entity_id}", response_model=RecordPermissionOut)
def grant_permission(
    entity_type: str,
    entity_id: str,
    body: RecordPermissionCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager),
):
    from app.services.record_permission_service import grant
    return grant(
        db, user.organization_id, entity_type, entity_id,
        permission=body.permission,
        granted_by_user_id=user.id,
        user_id=body.user_id,
        role=body.role,
        expires_at=body.expires_at,
    )


@router.delete("/{entity_type}/{entity_id}", status_code=204)
def revoke_permission(
    entity_type: str,
    entity_id: str,
    user_id: str | None = Query(default=None),
    role: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    from app.services.record_permission_service import revoke
    revoke(db, current_user.organization_id, entity_type, entity_id,
           user_id=user_id, role=role)


@router.get("/{entity_type}/{entity_id}/check")
def check_my_permission(
    entity_type: str,
    entity_id: str,
    required: str = Query(default="view"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.services.record_permission_service import check_permission
    allowed = check_permission(db, user, entity_type, entity_id, required)
    return {"allowed": allowed, "required": required}
