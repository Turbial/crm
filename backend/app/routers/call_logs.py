"""Call log management endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_staff
from app.models import User, CallLog
from app.schemas import CallLogCreate, CallLogOut

router = APIRouter(prefix="/call-logs", tags=["Call Logs"])


@router.post("", response_model=CallLogOut)
def log_call(
    body: CallLogCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff),
):
    call = CallLog(
        organization_id=user.organization_id,
        lead_id=body.lead_id,
        agent_user_id=user.id,
        direction=body.direction,
        disposition=body.disposition,
        duration_seconds=body.duration_seconds,
        recording_url=body.recording_url,
        notes=body.notes,
        started_at=body.started_at,
    )
    db.add(call)
    db.commit()
    db.refresh(call)
    return call


@router.get("", response_model=list[CallLogOut])
def list_calls(
    lead_id: str | None = Query(default=None),
    limit: int = Query(default=50, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(CallLog).filter(CallLog.organization_id == user.organization_id)
    if lead_id:
        q = q.filter(CallLog.lead_id == lead_id)
    return q.order_by(CallLog.started_at.desc()).limit(limit).all()


@router.get("/{call_id}", response_model=CallLogOut)
def get_call(
    call_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    call = db.query(CallLog).filter(
        CallLog.id == call_id,
        CallLog.organization_id == user.organization_id,
    ).first()
    if not call:
        raise HTTPException(status_code=404, detail="Call log not found")
    return call


@router.patch("/{call_id}", response_model=CallLogOut)
def update_call(
    call_id: str,
    body: CallLogCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff),
):
    call = db.query(CallLog).filter(
        CallLog.id == call_id,
        CallLog.organization_id == user.organization_id,
    ).first()
    if not call:
        raise HTTPException(status_code=404, detail="Call log not found")
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(call, field, val)
    db.commit()
    db.refresh(call)
    return call
