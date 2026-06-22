"""Celery tasks for drip sequence management."""
from __future__ import annotations

import logging

from app.celery_app import celery_app
from app.database import SessionLocal

logger = logging.getLogger("mighty.tasks.sequences")


@celery_app.task(name="tasks.process_sequence_steps")
def process_sequence_steps_task() -> dict:
    """Advance stalled enrollments — run as a periodic beat task."""
    from app.models import DripEnrollment, DripEnrollmentStatus
    from datetime import datetime

    db = SessionLocal()
    try:
        now = datetime.utcnow()
        stalled = (
            db.query(DripEnrollment)
            .filter(
                DripEnrollment.status == DripEnrollmentStatus.active,
                DripEnrollment.next_send_at <= now,
            )
            .limit(200)
            .all()
        )
        advanced = 0
        for enrollment in stalled:
            try:
                from app.services.sequence_engine import _schedule_next_step
                _schedule_next_step(db, enrollment)
                advanced += 1
            except Exception as exc:
                logger.error("Failed to advance enrollment %s: %s", enrollment.id, exc)
        return {"checked": len(stalled), "advanced": advanced}
    finally:
        db.close()
