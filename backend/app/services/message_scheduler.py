"""Scheduled message processor.

Picks up ScheduledMessage rows whose send_at has passed and dispatches
them via the appropriate channel. Called by the Celery periodic task.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.models import ScheduledMessage, ScheduledMessageStatus, Channel
from app.services import events

logger = logging.getLogger("mighty.scheduler")


def process_due_messages(db: Session) -> list[str]:
    """Find and send all messages due up to now. Returns list of processed message IDs."""
    now = datetime.utcnow()
    due = (
        db.query(ScheduledMessage)
        .filter(
            ScheduledMessage.status == ScheduledMessageStatus.scheduled,
            ScheduledMessage.send_at <= now,
        )
        .order_by(ScheduledMessage.send_at)
        .limit(100)
        .all()
    )

    processed: list[str] = []
    for msg in due:
        try:
            _send_message(db, msg)
            processed.append(msg.id)
        except Exception as exc:
            logger.error("Failed to send scheduled message %s: %s", msg.id, exc)
            msg.status = ScheduledMessageStatus.failed
            db.commit()

    return processed


def _send_message(db: Session, msg: ScheduledMessage) -> None:
    """Dispatch a single message through the correct channel."""
    channel = msg.channel
    if hasattr(channel, "value"):
        channel = channel.value

    result = _dispatch(channel, msg)

    msg.status = ScheduledMessageStatus.sent
    msg.sent_at = datetime.utcnow()
    db.commit()

    if msg.drip_enrollment_id:
        from app.services.sequence_engine import advance_enrollment
        advance_enrollment(db, msg.drip_enrollment_id)

    events.emit(
        "message.sent",
        message_id=msg.id,
        org_id=msg.organization_id,
        channel=channel,
        lead_id=msg.lead_id,
        result=result,
    )


def _dispatch(channel: str, msg: ScheduledMessage) -> dict[str, Any]:
    """Send via the channel. Returns a result dict for logging."""
    if channel == Channel.email.value:
        return _send_email(msg)
    elif channel == Channel.sms.value:
        return _send_sms(msg)
    else:
        logger.info("No sender configured for channel %s — marking sent", channel)
        return {"channel": channel, "simulated": True}


def _send_email(msg: ScheduledMessage) -> dict[str, Any]:
    from app.services.email_service import send_email
    to = msg.to_address or ""
    if not to:
        logger.warning("ScheduledMessage %s has no to_address, skipping email", msg.id)
        return {"provider": "skip", "reason": "no_to_address"}
    result = send_email(
        to=to,
        subject=msg.subject or "(no subject)",
        html_body=msg.content or "",
    )
    return {**result, "channel": "email"}


def _send_sms(msg: ScheduledMessage) -> dict[str, Any]:
    from app.services.sms_service import send_sms
    to = msg.to_address or ""
    if not to:
        logger.warning("ScheduledMessage %s has no to_address, skipping sms", msg.id)
        return {"provider": "skip", "reason": "no_to_address"}
    result = send_sms(to=to, body=msg.content or "")
    return {**result, "channel": "sms"}


def cancel_message(db: Session, org_id: str, message_id: str) -> bool:
    """Cancel a pending scheduled message."""
    msg = db.query(ScheduledMessage).filter(
        ScheduledMessage.id == message_id,
        ScheduledMessage.organization_id == org_id,
        ScheduledMessage.status == ScheduledMessageStatus.scheduled,
    ).first()
    if not msg:
        return False
    msg.status = ScheduledMessageStatus.canceled
    db.commit()
    return True
