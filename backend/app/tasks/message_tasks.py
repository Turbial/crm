"""Celery tasks for scheduled message delivery."""
from __future__ import annotations

import logging

from app.celery_app import celery_app
from app.database import SessionLocal

logger = logging.getLogger("mighty.tasks.messages")


@celery_app.task(name="tasks.process_scheduled_messages")
def process_scheduled_messages_task() -> dict:
    """Process all due scheduled messages. Run as a periodic beat task."""
    db = SessionLocal()
    try:
        from app.services.message_scheduler import process_due_messages
        processed = process_due_messages(db)
        return {"processed": len(processed), "ids": processed}
    except Exception as exc:
        logger.error("Scheduled message processing failed: %s", exc)
        raise
    finally:
        db.close()


@celery_app.task(bind=True, max_retries=3, default_retry_delay=30, name="tasks.send_single_message")
def send_single_message_task(self, message_id: str) -> bool:
    """Send a specific scheduled message immediately."""
    db = SessionLocal()
    try:
        from app.models import ScheduledMessage, ScheduledMessageStatus
        from app.services.message_scheduler import _send_message
        msg = db.query(ScheduledMessage).filter(
            ScheduledMessage.id == message_id,
            ScheduledMessage.status == ScheduledMessageStatus.scheduled,
        ).first()
        if not msg:
            return False
        _send_message(db, msg)
        return True
    except Exception as exc:
        logger.error("Send single message task failed for %s: %s", message_id, exc)
        raise self.retry(exc=exc)
    finally:
        db.close()
