"""Conversation service — omnichannel conversation lifecycle management."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.models import (
    Conversation, ConversationMessage, ConversationState,
    ConversationStatus, ConversationChannel,
)


def create_conversation(
    db: Session,
    org_id: str,
    channel: str = "internal",
    lead_id: str | None = None,
    contact_id: str | None = None,
    company_id: str | None = None,
    assigned_user_id: str | None = None,
    subject: str | None = None,
    priority: str = "normal",
    external_thread_id: str | None = None,
) -> Conversation:
    conv = Conversation(
        organization_id=org_id,
        channel=ConversationChannel(channel),
        lead_id=lead_id,
        contact_id=contact_id,
        company_id=company_id,
        assigned_user_id=assigned_user_id,
        subject=subject,
        priority=priority,
        external_thread_id=external_thread_id,
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return conv


def get_conversation(db: Session, org_id: str, conv_id: str) -> Conversation | None:
    return db.query(Conversation).filter(
        Conversation.id == conv_id,
        Conversation.organization_id == org_id,
    ).first()


def list_conversations(
    db: Session,
    org_id: str,
    status: str | None = None,
    channel: str | None = None,
    assigned_user_id: str | None = None,
    lead_id: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[Conversation]:
    q = db.query(Conversation).filter(Conversation.organization_id == org_id)
    if status:
        q = q.filter(Conversation.status == status)
    if channel:
        q = q.filter(Conversation.channel == channel)
    if assigned_user_id:
        q = q.filter(Conversation.assigned_user_id == assigned_user_id)
    if lead_id:
        q = q.filter(Conversation.lead_id == lead_id)
    return q.order_by(Conversation.updated_at.desc()).offset(offset).limit(limit).all()


def update_conversation(db: Session, org_id: str, conv_id: str, **kwargs) -> Conversation | None:
    conv = get_conversation(db, org_id, conv_id)
    if not conv:
        return None
    for k, v in kwargs.items():
        if hasattr(conv, k) and v is not None:
            setattr(conv, k, v)
    db.commit()
    db.refresh(conv)
    return conv


def assign_conversation(db: Session, org_id: str, conv_id: str, user_id: str) -> Conversation | None:
    conv = get_conversation(db, org_id, conv_id)
    if not conv:
        return None
    conv.assigned_user_id = user_id
    conv.status = ConversationStatus.open
    db.commit()
    db.refresh(conv)
    return conv


def resolve_conversation(db: Session, org_id: str, conv_id: str) -> Conversation | None:
    conv = get_conversation(db, org_id, conv_id)
    if not conv:
        return None
    conv.status = ConversationStatus.resolved
    conv.resolved_at = datetime.utcnow()
    db.commit()
    db.refresh(conv)
    return conv


def snooze_conversation(db: Session, org_id: str, conv_id: str, until: datetime) -> Conversation | None:
    conv = get_conversation(db, org_id, conv_id)
    if not conv:
        return None
    conv.status = ConversationStatus.snoozed
    conv.sla_due_at = until
    db.commit()
    db.refresh(conv)
    return conv


def link_entity(
    db: Session,
    org_id: str,
    conv_id: str,
    entity_type: str,
    entity_id: str,
) -> Conversation | None:
    conv = get_conversation(db, org_id, conv_id)
    if not conv:
        return None
    field_map = {"lead": "lead_id", "contact": "contact_id", "company": "company_id"}
    field = field_map.get(entity_type)
    if field:
        setattr(conv, field, entity_id)
    db.commit()
    db.refresh(conv)
    return conv


def add_message(
    db: Session,
    org_id: str,
    conv_id: str,
    sender_type: str,
    body: str,
    sender_id: str | None = None,
    sender_name: str | None = None,
    body_html: str | None = None,
    attachments: list | None = None,
    metadata: dict[str, Any] | None = None,
) -> ConversationMessage:
    msg = ConversationMessage(
        organization_id=org_id,
        conversation_id=conv_id,
        sender_type=sender_type,
        sender_id=sender_id,
        sender_name=sender_name,
        body=body,
        body_html=body_html,
        attachments=attachments or [],
        metadata_json=metadata or {},
        sent_at=datetime.utcnow(),
    )
    db.add(msg)
    # bump conversation updated_at
    conv = db.query(Conversation).filter(Conversation.id == conv_id).first()
    if conv:
        conv.updated_at = datetime.utcnow()  # type: ignore[assignment]
    db.commit()
    db.refresh(msg)
    return msg


def get_messages(
    db: Session,
    org_id: str,
    conv_id: str,
    limit: int = 50,
    offset: int = 0,
) -> list[ConversationMessage]:
    return db.query(ConversationMessage).filter(
        ConversationMessage.organization_id == org_id,
        ConversationMessage.conversation_id == conv_id,
    ).order_by(ConversationMessage.sent_at.asc()).offset(offset).limit(limit).all()
