"""Notification center endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.schemas import NotificationHubOut

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=list[NotificationHubOut])
def list_notifications(
    unread_only: bool = Query(default=False),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.services.notification_service import get_notifications
    return get_notifications(db, user.organization_id, user.id,
                             unread_only=unread_only, limit=limit, offset=offset)


@router.get("/unread-count")
def unread_count(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.services.notification_service import unread_count as _count
    return {"count": _count(db, user.organization_id, user.id)}


@router.post("/{notification_id}/read")
def mark_read(
    notification_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.services.notification_service import mark_read as _mark
    ok = _mark(db, notification_id, user.id)
    return {"ok": ok}


@router.post("/read-all")
def mark_all_read(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.services.notification_service import mark_all_read as _all
    count = _all(db, user.organization_id, user.id)
    return {"marked": count}
