"""Audit log read endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.deps import get_current_user, require_manager
from app.models import User, AuditLog

router = APIRouter(prefix="/audit-log", tags=["Audit Log"])


@router.get("")
def list_audit_log(
    entity_type: Optional[str] = Query(None),
    entity_id: Optional[str] = Query(None),
    actor_user_id: Optional[str] = Query(None),
    event: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    db: Session = Depends(get_db),
    user: User = Depends(require_manager),
):
    q = db.query(AuditLog).filter(AuditLog.organization_id == user.organization_id)
    if entity_type:
        q = q.filter(AuditLog.entity_type == entity_type)
    if entity_id:
        q = q.filter(AuditLog.entity_id == entity_id)
    if actor_user_id:
        q = q.filter(AuditLog.actor_user_id == actor_user_id)
    if event:
        q = q.filter(AuditLog.event == event)
    rows = q.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit).all()
    return [
        {
            "id": r.id,
            "event": r.event,
            "entity_type": r.entity_type,
            "entity_id": r.entity_id,
            "actor_user_id": r.actor_user_id,
            "actor_type": r.actor_type,
            "metadata": r.metadata_json,
            "created_at": r.created_at,
        }
        for r in rows
    ]
