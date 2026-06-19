"""AI-powered Messenger endpoints — classify, propose, and execute actions from text."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.schemas import (
    MessengerClassifyIn, MessengerClassifyOut,
    MessengerProposeIn, MessengerProposeOut,
    MessengerExecuteIn, MessengerExecuteOut,
    MessengerChatIn, MessengerChatOut,
)

router = APIRouter(prefix="/messenger/ai", tags=["Messenger AI"])


@router.post("/classify", response_model=MessengerClassifyOut)
def classify_intent(
    body: MessengerClassifyIn,
    user: User = Depends(get_current_user),
):
    """Classify the intent and extract entities from a raw text message."""
    from app.services.intent_classifier import classify
    result = classify(body.text)
    return MessengerClassifyOut(
        intent=result.intent,
        action_key=result.action_key,
        confidence=result.confidence,
        raw_entities=result.raw_entities,
        ambiguous=result.ambiguous,
        alternatives=[{"intent": i, "confidence": c} for i, c in result.alternatives],
    )


@router.post("/propose", response_model=MessengerProposeOut)
def propose_action(
    body: MessengerProposeIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Classify intent, link entities, and return a proposed action — without executing."""
    from app.services.intent_classifier import classify, build_input_payload
    from app.services.entity_linker import link_entities
    from app.services.action_registry import get_definition

    result = classify(body.text)
    if result.intent == "unknown" or not result.action_key:
        return MessengerProposeOut(
            intent="unknown",
            action_key="",
            confidence=result.confidence,
            linked_entities={},
            proposed_payload={},
            requires_approval=False,
            missing_fields=[],
        )

    linked = link_entities(db, user.organization_id, result.raw_entities)
    payload = build_input_payload(result.intent, result.raw_entities, linked)

    defn = get_definition(db, result.action_key, user.organization_id)
    requires_approval = defn.approval_required if defn else False

    # Identify obviously missing required fields
    missing: list[str] = []
    if result.action_key in ("crm.create_lead",) and "name" not in payload:
        missing.append("name")
    if result.action_key in ("pm.create_project",) and "name" not in payload:
        missing.append("name")
    if result.action_key in ("billing.create_payment_link",) and "amount_cents" not in payload:
        missing.append("amount_cents")

    return MessengerProposeOut(
        intent=result.intent,
        action_key=result.action_key,
        confidence=result.confidence,
        linked_entities=linked,
        proposed_payload=payload,
        requires_approval=requires_approval,
        missing_fields=missing,
        definition_display_name=defn.display_name if defn else None,
        definition_category=defn.category if defn else None,
    )


@router.post("/execute", response_model=MessengerExecuteOut)
def execute_from_text(
    body: MessengerExecuteIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Full pipeline: classify → link entities → execute action → return ActionRun."""
    from app.services.intent_classifier import classify, build_input_payload
    from app.services.entity_linker import link_entities
    from app.services.action_executor import execute_with_approval_check

    result = classify(body.text)
    if result.intent == "unknown" or not result.action_key:
        raise HTTPException(status_code=422, detail=f"Could not classify intent from: '{body.text}'")

    if result.confidence < body.min_confidence:
        raise HTTPException(
            status_code=422,
            detail=f"Low confidence ({result.confidence:.2f} < {body.min_confidence}). "
                   f"Classified as '{result.intent}'. Use /ai/propose first."
        )

    linked = link_entities(db, user.organization_id, result.raw_entities)
    payload = {**build_input_payload(result.intent, result.raw_entities, linked),
               **(body.payload_override or {})}

    outcome = execute_with_approval_check(
        db,
        org_id=user.organization_id,
        action_key=result.action_key,
        input_payload=payload,
        requested_by_type="human",
        requested_by_id=user.id,
        source="messenger_ai",
    )

    return MessengerExecuteOut(**outcome)


@router.post("/chat", response_model=MessengerChatOut)
def chat(
    body: MessengerChatIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Full conversational pipeline:
    1. Persist user message to conversation
    2. Classify intent
    3. Link entities, update ConversationState
    4. If action_key + auto_execute: execute → return result card
    5. If requires approval or missing fields: return proposal card
    6. Always persist assistant response as conversation message
    """
    from app.services.intent_classifier import classify, build_input_payload
    from app.services.entity_linker import link_entities
    from app.services.conversation_service import get_conversation, add_message, create_conversation
    from app.services.conversation_state_service import (
        get_or_create_state, update_intent, push_context, remember_entity
    )
    from app.services.action_executor import execute_with_approval_check
    from app.services.action_registry import get_definition

    org_id = user.organization_id

    # Get or create conversation
    if body.conversation_id:
        conv = get_conversation(db, org_id, body.conversation_id)
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found")
    else:
        conv = create_conversation(db, org_id, channel="messenger",
                                   assigned_user_id=user.id)

    # Persist user message
    user_msg = add_message(db, org_id, conv.id, sender_type="human",
                           body=body.text, sender_id=user.id, sender_name=user.name)

    # Get/update ConversationState
    state = get_or_create_state(db, org_id, conv.id)
    push_context(db, state, "human", body.text)

    # Classify
    result = classify(body.text)
    linked = link_entities(db, org_id, result.raw_entities)
    payload = build_input_payload(result.intent, result.raw_entities, linked)

    # Update state with new intent
    update_intent(db, state, intent=result.intent,
                  action_key=result.action_key or state.pending_action_key,
                  action_payload=payload)

    # Remember primary entities
    if "lead_id" in linked:
        remember_entity(db, state, "lead", linked["lead_id"])
    elif "company_id" in linked:
        remember_entity(db, state, "company", linked["company_id"])

    response_card: dict = {}
    assistant_text = ""

    if result.action_key and result.confidence >= 0.65 and body.auto_execute:
        defn = get_definition(db, result.action_key, org_id)
        outcome = execute_with_approval_check(
            db, org_id=org_id,
            action_key=result.action_key,
            input_payload=payload,
            requested_by_type="human",
            requested_by_id=user.id,
            source="messenger_chat",
        )
        response_card = outcome
        if outcome["status"] == "waiting_approval":
            assistant_text = (f"I've queued '{defn.display_name if defn else result.action_key}' "
                              f"for approval. An approver will be notified.")
        elif outcome["status"] == "completed":
            assistant_text = (f"Done! '{defn.display_name if defn else result.action_key}' "
                              f"completed successfully.")
        else:
            assistant_text = f"Action failed: {outcome.get('error', 'unknown error')}"
    elif result.action_key:
        defn = get_definition(db, result.action_key, org_id)
        missing: list[str] = []
        if result.action_key in ("crm.create_lead",) and "name" not in payload:
            missing.append("name")
        if missing:
            assistant_text = (f"I want to {defn.display_name if defn else result.intent}, "
                              f"but I need: {', '.join(missing)}. Can you provide those?")
        else:
            assistant_text = (f"I can {defn.display_name if defn else result.intent}. "
                              f"Shall I proceed? (Use auto_execute: true to execute automatically)")
        response_card = {
            "proposed": True,
            "intent": result.intent,
            "action_key": result.action_key,
            "payload": payload,
            "missing_fields": missing,
        }
    else:
        assistant_text = "I'm not sure what action to take. Can you be more specific?"

    # Persist assistant response
    assistant_msg = add_message(db, org_id, conv.id, sender_type="agent",
                                body=assistant_text, sender_name="MightyOps AI",
                                metadata={"card": response_card, "intent": result.intent,
                                          "confidence": result.confidence})
    push_context(db, state, "assistant", assistant_text, metadata=response_card)

    return MessengerChatOut(
        conversation_id=conv.id,
        user_message_id=user_msg.id,
        assistant_message_id=assistant_msg.id,
        assistant_text=assistant_text,
        intent=result.intent,
        confidence=result.confidence,
        action_key=result.action_key,
        linked_entities=linked,
        card=response_card,
    )
