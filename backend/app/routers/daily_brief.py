"""Daily brief endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_manager
from app.models import User, DailyBrief
from app.schemas import DailyBriefOut

router = APIRouter(prefix="/daily-brief", tags=["Daily Brief"])


@router.get("/latest", response_model=DailyBriefOut)
def get_latest(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.services.daily_brief_service import get_latest_brief
    brief = get_latest_brief(db, user.organization_id)
    if not brief:
        raise HTTPException(status_code=404, detail="No brief generated yet")
    return brief


@router.get("/{brief_id}", response_model=DailyBriefOut)
def get_brief(
    brief_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    brief = db.query(DailyBrief).filter(
        DailyBrief.id == brief_id,
        DailyBrief.organization_id == user.organization_id,
    ).first()
    if not brief:
        raise HTTPException(status_code=404, detail="Brief not found")
    return brief


@router.post("/generate", response_model=DailyBriefOut)
def generate(
    db: Session = Depends(get_db),
    user: User = Depends(require_manager),
):
    """Manually trigger brief generation and delivery."""
    from app.services.daily_brief_service import generate_brief, deliver_brief
    brief = generate_brief(db, user.organization_id, user_id=user.id)
    deliver_brief(db, brief)
    return brief
