"""Drip sequence engine.

Handles enrollment, step advancement, and message scheduling for drip sequences.
The actual message sending is delegated to ScheduledMessage rows, which are
picked up by the message scheduler Celery task.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.models import (
    DripSequence, DripStep, DripEnrollment, DripEnrollmentStatus,
    Lead, ScheduledMessage, ScheduledMessageStatus,
)

logger = logging.getLogger("mighty.sequences")


def enroll_lead(db: Session, org_id: str, sequence_id: str, lead_id: str) -> DripEnrollment:
    """Enroll a lead in a drip sequence, scheduling the first step immediately."""
    seq = db.query(DripSequence).filter(
        DripSequence.id == sequence_id, DripSequence.organization_id == org_id
    ).first()
    if not seq:
        raise ValueError(f"Sequence {sequence_id} not found")

    lead = db.query(Lead).filter(Lead.id == lead_id, Lead.organization_id == org_id).first()
    if not lead:
        raise ValueError(f"Lead {lead_id} not found")

    # Prevent double-enrollment
    existing = db.query(DripEnrollment).filter(
        DripEnrollment.sequence_id == sequence_id,
        DripEnrollment.lead_id == lead_id,
        DripEnrollment.status == DripEnrollmentStatus.active,
    ).first()
    if existing:
        return existing

    enrollment = DripEnrollment(
        organization_id=org_id,
        sequence_id=sequence_id,
        lead_id=lead_id,
        current_step=0,
        status=DripEnrollmentStatus.active,
    )
    db.add(enrollment)
    db.commit()
    db.refresh(enrollment)

    _schedule_next_step(db, enrollment, seq)
    return enrollment


def _schedule_next_step(db: Session, enrollment: DripEnrollment, seq: DripSequence | None = None) -> bool:
    """Schedule the next unexecuted step for this enrollment. Returns False if sequence is done."""
    if seq is None:
        seq = db.get(DripSequence, enrollment.sequence_id)

    steps: list[DripStep] = sorted(
        db.query(DripStep)
        .filter(DripStep.sequence_id == enrollment.sequence_id)
        .all(),
        key=lambda s: s.position,
    )
    next_step_index = enrollment.current_step
    if next_step_index >= len(steps):
        enrollment.status = DripEnrollmentStatus.completed
        enrollment.completed_at = datetime.utcnow()
        db.commit()
        return False

    step = steps[next_step_index]
    send_at = datetime.utcnow() + timedelta(hours=step.delay_hours)

    lead = db.get(Lead, enrollment.lead_id)
    content = _render(step.message_template, lead)

    msg = ScheduledMessage(
        organization_id=enrollment.organization_id,
        lead_id=enrollment.lead_id,
        drip_enrollment_id=enrollment.id,
        channel=seq.channel,
        subject=step.subject,
        content=content,
        send_at=send_at,
        status=ScheduledMessageStatus.scheduled,
    )
    db.add(msg)
    enrollment.next_send_at = send_at
    enrollment.current_step = next_step_index + 1
    db.commit()
    return True


def advance_enrollment(db: Session, enrollment_id: str) -> bool:
    """Called after a step is delivered — schedule the next one."""
    enrollment = db.get(DripEnrollment, enrollment_id)
    if not enrollment or enrollment.status != DripEnrollmentStatus.active:
        return False
    return _schedule_next_step(db, enrollment)


def unenroll(db: Session, org_id: str, enrollment_id: str) -> bool:
    enrollment = db.query(DripEnrollment).filter(
        DripEnrollment.id == enrollment_id, DripEnrollment.organization_id == org_id
    ).first()
    if not enrollment:
        return False
    enrollment.status = DripEnrollmentStatus.unsubscribed
    db.commit()
    return True


def _render(template: str, lead: Lead | None) -> str:
    """Simple variable substitution: {{lead_name}}, {{company}}, etc."""
    if not lead:
        return template
    replacements = {
        "{{lead_name}}": lead.name or "",
        "{{company}}": lead.company or "",
        "{{email}}": lead.email or "",
        "{{phone}}": lead.phone or "",
        "{{city}}": lead.city or "",
    }
    result = template
    for key, val in replacements.items():
        result = result.replace(key, val)
    return result
