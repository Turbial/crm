"""ConversationState service — short-term AI memory per conversation thread."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.models import ConversationState


MAX_CONTEXT_WINDOW = 12   # messages to keep in rolling context


def get_or_create_state(db: Session, org_id: str, conv_id: str) -> ConversationState:
    state = db.query(ConversationState).filter(
        ConversationState.conversation_id == conv_id,
        ConversationState.organization_id == org_id,
    ).first()
    if not state:
        state = ConversationState(
            organization_id=org_id,
            conversation_id=conv_id,
        )
        db.add(state)
        db.commit()
        db.refresh(state)
    return state


def update_intent(
    db: Session,
    state: ConversationState,
    intent: str,
    active_entity_type: str | None = None,
    active_entity_id: str | None = None,
    action_key: str | None = None,
    action_payload: dict | None = None,
    unresolved_fields: dict | None = None,
) -> ConversationState:
    state.current_intent = intent
    state.updated_at = datetime.utcnow()
    if active_entity_type is not None:
        state.active_entity_type = active_entity_type
    if active_entity_id is not None:
        state.active_entity_id = active_entity_id
    if action_key is not None:
        state.pending_action_key = action_key
    if action_payload is not None:
        state.pending_action_payload = action_payload
    if unresolved_fields is not None:
        state.unresolved_fields = unresolved_fields
    db.commit()
    db.refresh(state)
    return state


def remember_entity(
    db: Session,
    state: ConversationState,
    entity_type: str,
    entity_id: str,
) -> None:
    state.active_entity_type = entity_type
    state.active_entity_id = entity_id
    if entity_type == "contact":
        state.last_mentioned_contact_id = entity_id
    elif entity_type == "project":
        state.last_mentioned_project_id = entity_id
    state.updated_at = datetime.utcnow()
    db.commit()


def push_context(
    db: Session,
    state: ConversationState,
    sender_type: str,
    body: str,
    metadata: dict[str, Any] | None = None,
) -> None:
    window: list = list(state.context_window or [])
    window.append({
        "role": "user" if sender_type in ("human", "customer") else "assistant",
        "sender_type": sender_type,
        "content": body,
        **({"meta": metadata} if metadata else {}),
    })
    if len(window) > MAX_CONTEXT_WINDOW:
        window = window[-MAX_CONTEXT_WINDOW:]
    state.context_window = window
    state.updated_at = datetime.utcnow()
    db.commit()


def clear_pending_action(db: Session, state: ConversationState) -> None:
    state.pending_action_key = None
    state.pending_action_payload = {}
    state.unresolved_fields = {}
    state.updated_at = datetime.utcnow()
    db.commit()


def set_unresolved_fields(
    db: Session,
    state: ConversationState,
    fields: dict[str, str],
) -> None:
    """fields: {field_name: human-readable question to ask}"""
    state.unresolved_fields = fields
    state.updated_at = datetime.utcnow()
    db.commit()
