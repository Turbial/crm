"""Scheduled message management endpoints."""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_staff
from app.models import User, ScheduledMessage, ScheduledMessageStatus
from app.schemas import ScheduledMessageCreate, ScheduledMessageOut

router = APIRouter(prefix="/scheduled-messages", tags=["Scheduled Messages"])


@router.post("", response_model=ScheduledMessageOut)
def schedule_message(
    body: ScheduledMessageCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff),
):
    msg = ScheduledMessage(
        organization_id=user.organization_id,
        lead_id=body.lead_id,
        channel=body.channel,
        subject=body.subject,
        content=body.content,
        send_at=body.send_at,
        status=ScheduledMessageStatus.scheduled,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg


@router.get("", response_model=list[ScheduledMessageOut])
def list_messages(
    lead_id: str | None = Query(default=None),
    status: ScheduledMessageStatus | None = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(ScheduledMessage).filter(
        ScheduledMessage.organization_id == user.organization_id
    )
    if lead_id:
        q = q.filter(ScheduledMessage.lead_id == lead_id)
    if status:
        q = q.filter(ScheduledMessage.status == status)
    return q.order_by(ScheduledMessage.send_at).limit(200).all()


@router.get("/{msg_id}", response_model=ScheduledMessageOut)
def get_message(
    msg_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    msg = db.query(ScheduledMessage).filter(
        ScheduledMessage.id == msg_id,
        ScheduledMessage.organization_id == user.organization_id,
    ).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    return msg


@router.post("/{msg_id}/cancel", response_model=ScheduledMessageOut)
def cancel_message(
    msg_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff),
):
    from app.services.message_scheduler import cancel_message as _cancel
    if not _cancel(db, user.organization_id, msg_id):
        raise HTTPException(status_code=404, detail="Message not found or already sent")
    msg = db.query(ScheduledMessage).filter(ScheduledMessage.id == msg_id).first()
    return msg


@router.post("/{msg_id}/send-now")
def send_now(
    msg_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff),
):
    msg = db.query(ScheduledMessage).filter(
        ScheduledMessage.id == msg_id,
        ScheduledMessage.organization_id == user.organization_id,
        ScheduledMessage.status == ScheduledMessageStatus.scheduled,
    ).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found or not in scheduled state")
    msg.send_at = datetime.utcnow()
    db.commit()
    from app.tasks.message_tasks import send_single_message_task
    send_single_message_task.delay(msg_id)
    return {"queued": True, "message_id": msg_id}
