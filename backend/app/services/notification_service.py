"""In-app notification delivery service.

Creates Notification rows and (optionally) triggers Messenger/email delivery
based on user preferences. The delivery side is stub-ready for real channels.
"""
from __future__ import annotations

import logging
from typing import Any

from sqlalchemy.orm import Session

from app.models import Notification

logger = logging.getLogger("mighty.notifications")

# Notification type constants
NT_TASK_ASSIGNED = "task_assigned"
NT_TASK_DUE = "task_due"
NT_TASK_OVERDUE = "task_overdue"
NT_APPROVAL_NEEDED = "approval_needed"
NT_APPROVAL_DECIDED = "approval_decided"
NT_DEAL_MOVED = "deal_moved"
NT_ACTION_FAILED = "action_failed"
NT_ACTION_COMPLETED = "action_completed"
NT_INVOICE_PAID = "invoice_paid"
NT_LEAD_ASSIGNED = "lead_assigned"
NT_MENTION = "mention"
NT_AGENT_NEEDS_HELP = "agent_needs_help"
NT_SEQUENCE_COMPLETED = "sequence_completed"
NT_ESIGNATURE_SIGNED = "esignature_signed"


def notify(
    db: Session,
    org_id: str,
    user_id: str,
    title: str,
    body: str | None = None,
    notification_type: str = "general",
    action_url: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> Notification:
    """Create an in-app notification for a specific user."""
    n = Notification(
        organization_id=org_id,
        user_id=user_id,
        title=title,
        body=body,
        read=False,
        action_url=action_url,
        metadata_json={**(metadata or {}), "type": notification_type},
    )
    db.add(n)
    db.commit()
    db.refresh(n)
    _maybe_deliver_realtime(n)
    return n


def notify_org_managers(
    db: Session,
    org_id: str,
    title: str,
    body: str | None = None,
    notification_type: str = "general",
    action_url: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> list[Notification]:
    """Send notification to all managers and owners in the org."""
    from app.models import User, UserRole
    managers = db.query(User).filter(
        User.organization_id == org_id,
        User.role.in_([UserRole.owner, UserRole.manager]),
        User.is_active == True,
    ).all()
    notifications = []
    for mgr in managers:
        n = notify(db, org_id, mgr.id, title, body, notification_type, action_url, metadata)
        notifications.append(n)
    return notifications


def get_notifications(
    db: Session,
    org_id: str,
    user_id: str,
    unread_only: bool = False,
    limit: int = 50,
    offset: int = 0,
) -> list[Notification]:
    q = db.query(Notification).filter(
        Notification.organization_id == org_id,
        Notification.user_id == user_id,
    )
    if unread_only:
        q = q.filter(Notification.read == False)
    return q.order_by(Notification.created_at.desc()).offset(offset).limit(limit).all()


def mark_read(db: Session, notification_id: str, user_id: str) -> bool:
    n = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == user_id,
    ).first()
    if not n:
        return False
    n.read = True
    db.commit()
    return True


def mark_all_read(db: Session, org_id: str, user_id: str) -> int:
    updated = db.query(Notification).filter(
        Notification.organization_id == org_id,
        Notification.user_id == user_id,
        Notification.read == False,
    ).update({"read": True})
    db.commit()
    return updated


def unread_count(db: Session, org_id: str, user_id: str) -> int:
    return db.query(Notification).filter(
        Notification.organization_id == org_id,
        Notification.user_id == user_id,
        Notification.read == False,
    ).count()


def _maybe_deliver_realtime(notification: Notification) -> None:
    """Stub for WebSocket / push / Messenger delivery. Wire real channels here."""
    logger.debug("Notification created for user %s: %s", notification.user_id, notification.title)
