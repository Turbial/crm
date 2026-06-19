"""Cross-object search endpoint."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import User

router = APIRouter(prefix="/search", tags=["Search"])


@router.get("")
def search(
    q: str = Query(..., min_length=2, description="Search query"),
    types: str | None = Query(default=None, description="Comma-separated entity types"),
    limit_per_type: int = Query(default=8, le=20),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.services.search_service import search as _search
    type_list = [t.strip() for t in types.split(",")] if types else None
    return _search(db, user.organization_id, q, types=type_list, limit_per_type=limit_per_type)


@router.get("/suggest")
def suggest(
    q: str = Query(..., min_length=2),
    limit: int = Query(default=8, le=20),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.services.search_service import suggest as _suggest
    return _suggest(db, user.organization_id, q, limit=limit)
