"""Unified activity timeline service.

Writes TimelineEvent rows and provides a paginated read API.
Writers call `record()` from anywhere; readers query by entity.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.models import TimelineEvent


def record(
    db: Session,
    org_id: str,
    entity_type: str,
    entity_id: str,
    event_type: str,
    summary: str,
    actor_type: str = "system",
    actor_id: str | None = None,
    actor_name: str | None = None,
    metadata: dict[str, Any] | None = None,
    occurred_at: datetime | None = None,
) -> TimelineEvent:
    """Write a timeline event. Call this from service code after any significant state change."""
    event = TimelineEvent(
        organization_id=org_id,
        entity_type=entity_type,
        entity_id=entity_id,
        event_type=event_type,
        actor_type=actor_type,
        actor_id=actor_id,
        actor_name=actor_name,
        summary=summary,
        metadata_json=metadata or {},
        occurred_at=occurred_at or datetime.utcnow(),
    )
    db.add(event)
    # Caller is responsible for commit (batch with the triggering operation).
    return event


def get_timeline(
    db: Session,
    org_id: str,
    entity_type: str,
    entity_id: str,
    limit: int = 50,
    offset: int = 0,
    event_types: list[str] | None = None,
) -> list[TimelineEvent]:
    """Fetch the timeline for a single entity, newest first."""
    q = db.query(TimelineEvent).filter(
        TimelineEvent.organization_id == org_id,
        TimelineEvent.entity_type == entity_type,
        TimelineEvent.entity_id == entity_id,
    )
    if event_types:
        q = q.filter(TimelineEvent.event_type.in_(event_types))
    return q.order_by(TimelineEvent.occurred_at.desc()).offset(offset).limit(limit).all()


def get_org_feed(
    db: Session,
    org_id: str,
    limit: int = 100,
    offset: int = 0,
    entity_types: list[str] | None = None,
    actor_type: str | None = None,
) -> list[TimelineEvent]:
    """Org-wide activity feed — used for the dashboard and agent supervisor."""
    q = db.query(TimelineEvent).filter(TimelineEvent.organization_id == org_id)
    if entity_types:
        q = q.filter(TimelineEvent.entity_type.in_(entity_types))
    if actor_type:
        q = q.filter(TimelineEvent.actor_type == actor_type)
    return q.order_by(TimelineEvent.occurred_at.desc()).offset(offset).limit(limit).all()


# ─── Convenience writers for common events ────────────────────────────────────

def record_lead_status_changed(db, org_id, lead_id, old_status, new_status, actor_id=None, actor_name=None):
    record(db, org_id, "lead", lead_id, "lead_status_changed",
           f"Status changed from {old_status} to {new_status}",
           actor_type="human" if actor_id else "system",
           actor_id=actor_id, actor_name=actor_name,
           metadata={"old_status": str(old_status), "new_status": str(new_status)})


def record_note_added(db, org_id, lead_id, note_id, actor_id=None, actor_name=None, is_agent=False):
    record(db, org_id, "lead", lead_id, "note_added", "Note added",
           actor_type="agent" if is_agent else "human",
           actor_id=actor_id, actor_name=actor_name,
           metadata={"note_id": note_id})


def record_call_logged(db, org_id, lead_id, call_id, disposition, duration_seconds, actor_id=None):
    record(db, org_id, "lead", lead_id, "call_logged",
           f"Call logged ({disposition}, {duration_seconds}s)",
           actor_type="human", actor_id=actor_id,
           metadata={"call_id": call_id, "disposition": disposition, "duration_seconds": duration_seconds})


def record_email_sent(db, org_id, lead_id, subject, actor_type="system"):
    record(db, org_id, "lead", lead_id, "email_sent",
           f"Email sent: {subject}", actor_type=actor_type,
           metadata={"subject": subject})


def record_deal_moved(db, org_id, deal_id, old_stage, new_stage, actor_id=None, actor_name=None):
    record(db, org_id, "deal", deal_id, "deal_stage_changed",
           f"Deal moved from {old_stage} to {new_stage}",
           actor_type="human" if actor_id else "system",
           actor_id=actor_id, actor_name=actor_name,
           metadata={"old_stage": old_stage, "new_stage": new_stage})


def record_payment_received(db, org_id, entity_id, amount, currency="usd", entity_type="lead"):
    record(db, org_id, entity_type, entity_id, "payment_received",
           f"Payment received: {currency.upper()} {amount:.2f}",
           actor_type="system", metadata={"amount": amount, "currency": currency})


def record_agent_action(db, org_id, entity_id, entity_type, action_type, result_summary, action_id=None):
    record(db, org_id, entity_type, entity_id, "agent_action",
           f"Agent action: {action_type} — {result_summary}",
           actor_type="agent", actor_id=action_id,
           metadata={"action_type": action_type, "action_id": action_id})


def record_file_uploaded(db, org_id, entity_type, entity_id, filename, actor_id=None, actor_name=None):
    record(db, org_id, entity_type, entity_id, "file_uploaded",
           f"File uploaded: {filename}",
           actor_type="human" if actor_id else "system",
           actor_id=actor_id, actor_name=actor_name,
           metadata={"filename": filename})


def record_approval(db, org_id, entity_type, entity_id, decision, title, actor_id=None, actor_name=None):
    record(db, org_id, entity_type, entity_id, f"approval_{decision}",
           f"Approval {decision}: {title}",
           actor_type="human", actor_id=actor_id, actor_name=actor_name,
           metadata={"decision": decision, "title": title})
