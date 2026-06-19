"""Unified activity timeline endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.schemas import TimelineEventOut

router = APIRouter(prefix="/timeline", tags=["Timeline"])


@router.get("/{entity_type}/{entity_id}", response_model=list[TimelineEventOut])
def get_entity_timeline(
    entity_type: str,
    entity_id: str,
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    event_types: str | None = Query(default=None, description="Comma-separated event type filter"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.services.timeline_service import get_timeline
    types = [t.strip() for t in event_types.split(",")] if event_types else None
    return get_timeline(db, user.organization_id, entity_type, entity_id,
                        limit=limit, offset=offset, event_types=types)


@router.get("/feed/org", response_model=list[TimelineEventOut])
def org_activity_feed(
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0, ge=0),
    entity_types: str | None = Query(default=None),
    actor_type: str | None = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.services.timeline_service import get_org_feed
    types = [t.strip() for t in entity_types.split(",")] if entity_types else None
    return get_org_feed(db, user.organization_id, limit=limit, offset=offset,
                        entity_types=types, actor_type=actor_type)
