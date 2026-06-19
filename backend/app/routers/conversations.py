"""Omnichannel conversation endpoints."""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_manager
from app.models import User
from app.schemas import (
    ConversationCreate, ConversationUpdate, ConversationOut,
    ConversationMessageCreate, ConversationMessageOut,
)

router = APIRouter(prefix="/conversations", tags=["Conversations"])


@router.post("", response_model=ConversationOut)
def create_conversation(
    body: ConversationCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.services.conversation_service import create_conversation as _create
    return _create(
        db, user.organization_id,
        channel=body.channel,
        lead_id=body.lead_id,
        contact_id=body.contact_id,
        company_id=body.company_id,
        assigned_user_id=body.assigned_user_id or user.id,
        subject=body.subject,
        priority=body.priority,
        external_thread_id=body.external_thread_id,
    )


@router.get("", response_model=list[ConversationOut])
def list_conversations(
    status: str | None = Query(default=None),
    channel: str | None = Query(default=None),
    assigned_user_id: str | None = Query(default=None),
    lead_id: str | None = Query(default=None),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.services.conversation_service import list_conversations as _list
    return _list(
        db, user.organization_id,
        status=status, channel=channel,
        assigned_user_id=assigned_user_id,
        lead_id=lead_id,
        limit=limit, offset=offset,
    )


@router.get("/{conv_id}", response_model=ConversationOut)
def get_conversation(
    conv_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.services.conversation_service import get_conversation as _get
    conv = _get(db, user.organization_id, conv_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv


@router.patch("/{conv_id}", response_model=ConversationOut)
def update_conversation(
    conv_id: str,
    body: ConversationUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.services.conversation_service import update_conversation as _update
    conv = _update(db, user.organization_id, conv_id,
                   **body.model_dump(exclude_unset=True))
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv


@router.get("/{conv_id}/messages", response_model=list[ConversationMessageOut])
def list_messages(
    conv_id: str,
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.services.conversation_service import get_conversation, get_messages
    conv = get_conversation(db, user.organization_id, conv_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return get_messages(db, user.organization_id, conv_id, limit=limit, offset=offset)


@router.post("/{conv_id}/messages", response_model=ConversationMessageOut)
def send_message(
    conv_id: str,
    body: ConversationMessageCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.services.conversation_service import get_conversation, add_message
    from app.services.conversation_state_service import get_or_create_state, push_context
    conv = get_conversation(db, user.organization_id, conv_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    msg = add_message(
        db, user.organization_id, conv_id,
        sender_type="human",
        body=body.body,
        sender_id=user.id,
        sender_name=user.name,
        body_html=body.body_html,
    )
    state = get_or_create_state(db, user.organization_id, conv_id)
    push_context(db, state, "human", body.body)
    return msg


@router.post("/{conv_id}/assign", response_model=ConversationOut)
def assign_conversation(
    conv_id: str,
    assignee_user_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager),
):
    from app.services.conversation_service import assign_conversation as _assign
    conv = _assign(db, user.organization_id, conv_id, assignee_user_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv


@router.post("/{conv_id}/resolve", response_model=ConversationOut)
def resolve_conversation(
    conv_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.services.conversation_service import resolve_conversation as _resolve
    conv = _resolve(db, user.organization_id, conv_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv


@router.post("/{conv_id}/snooze", response_model=ConversationOut)
def snooze_conversation(
    conv_id: str,
    until: datetime,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.services.conversation_service import snooze_conversation as _snooze
    conv = _snooze(db, user.organization_id, conv_id, until)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv


@router.post("/{conv_id}/link", response_model=ConversationOut)
def link_entity(
    conv_id: str,
    entity_type: str,
    entity_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.services.conversation_service import link_entity as _link
    conv = _link(db, user.organization_id, conv_id, entity_type, entity_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv
